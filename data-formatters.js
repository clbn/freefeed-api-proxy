import fetch from 'isomorphic-unfetch';

import { config } from './config.js';

export const formatAttachment = attachment => {
  if (!attachment) return null;

  const { mediaType, fileName, fileSize, imageSizes, thumbnailUrl, url } = attachment;

  if (mediaType !== 'image') {
    return { mediaType, fileName, fileSize, url };
  }

  const formattedFileSize = fileSize; // TODO: numeral(fileSize).format('0.[0] b');
  const formattedImageSize = (imageSizes.o ? `, ${imageSizes.o.w}×${imageSizes.o.h}px` : '');
  const nameAndSize = fileName + ' (' + formattedFileSize + formattedImageSize + ')';

  let srcSet = null;
  if (imageSizes.t2?.url) {
    srcSet = imageSizes.t2.url + ' 2x';
  } else if (+imageSizes.o?.w <= +imageSizes.t?.w * 2) {
    srcSet = (imageSizes.o?.url || url) + ' 2x';
  }

  return {
    mediaType,
    url: imageSizes.o?.url || url,
    nameAndSize,
    src: imageSizes.t?.url || thumbnailUrl,
    srcSet,
    width: imageSizes.t?.w || imageSizes.o?.w || null,
    height: imageSizes.t?.h || imageSizes.o?.h || null,
  };
};

export const formatComment = comment => {
  if (!comment) return null;

  const formattedComment = {
    body: comment.body,
    authorId: comment.createdBy,
    createdAt: +comment.createdAt,
    seqNumber: comment.seqNumber,
  };

  if (comment.hideType) formattedComment.hideType = comment.hideType;
  if (comment.likes) formattedComment.likes = comment.likes;
  if (comment.hasOwnLike) formattedComment.haveILiked = comment.hasOwnLike;

  return formattedComment;
};

export const formatPost = post => {
  if (!post) return null;

  return {
    shortId: post.shortId,
    body: post.body,
    authorId: post.createdBy,
    createdAt: +post.createdAt,
    recipientFeedIds: post.postedTo,
    attachmentIds: post.attachments,
    likerIds: post.likes,
    omittedLikes: +post.omittedLikes,
    commentIds: post.comments,
    omittedComments: +post.omittedComments,
    omittedCommentLikes: +post.omittedCommentLikes,
    areCommentsDisabled: post.commentsDisabled === '1',
    backlinksCount: +post.backlinksCount,
  };
};

export const formatUser = (user, fuller) => {
  if (!user) return null;

  const formattedUser = {
    id: user.id,
    username: user.username,
    type: user.type, // 'user' or 'group'
    displayName: user.screenName,
    userpicUrl: user.profilePictureLargeUrl,
    isGone: !!user.isGone,
    isPrivate: user.isPrivate === '1',
    isProtected: user.isProtected === '1',
  };

  if (user.type === 'group') {
    formattedUser.administrators = user.administrators || [];

    if (user.isRestricted === '1') {
      formattedUser.isRestricted = true;
    }
  }

  if (fuller) {
    formattedUser.description = user.description;

    formattedUser.statistics = Object.fromEntries(
      Object.entries(user.statistics).map(
        ([k, v]) => [k, +v] // convert each value in user.statistics into a number
      )
    );
  }

  return formattedUser;
};

const keyByIdAndMap = (items, cb) => {
  if (!items) return null;

  const result = {};

  items.forEach(i => {
    result[i.id] = cb ? cb(i) : i;
  });

  return result;
};

export const prepareMe = data => {
  let me = {};
  if (data.users) {
    me = formatUser(data.users);
  }
  return me;
}

export const pickRequiredUsers = (data, chosenOne) => {
  // 3.1. Get their IDs from comments, feeds, posts and likes
  let requiredUsers = {};
  data.comments.forEach(c => { requiredUsers[c.createdBy] = 'c'; });
  data.subscriptions.forEach(f => { requiredUsers[f.user] = 'f'; }); // feeds, post recipients

  const posts = Array.isArray(data.posts) ? data.posts : [ data.posts ];
  posts.forEach(p => {
    requiredUsers[p.createdBy] = 'p';
    p.likes.forEach(l => { requiredUsers[l] = 'l'; });
  });

  // 3.2. Get required users from data.users
  data.users.forEach(u => {
    if (requiredUsers[u.id]) {
      requiredUsers[u.id] = formatUser(u);
    }

    // Usually the userpage's user is already in requiredUsers, added via the posts (in 3.1 above),
    // but if it's a private page, data.posts might be empty, so we need to add it to requiredUsers separately.
    if (u.username === chosenOne) {
      requiredUsers[u.id] = formatUser(u, true);
    }
  });

  // 3.3. Get the rest of required users from data.subscribers
  data.subscribers.forEach(u => {
    if (requiredUsers[u.id] && !requiredUsers[u.id].id) {
      requiredUsers[u.id] = formatUser(u);
    }
  });

  return requiredUsers;
};

const addSubscriptionInfoToUsers = (users, myData) => {
  const subscriptionsUserIds = myData.subscriptions.map(s => s.user); // IDs of users I subscribed to
  Object.values(users).forEach(u => {
    if (subscriptionsUserIds.includes(u.id)) {
      u.amISubscribed = true;
    }
  });
}

export const loadAndFormat = async (pageDataUrl, token, username, postId, justMe) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = token;
  }

  const [myResponse, pageResponse] = await Promise.all([
    fetch(`${config.api.host}/v2/users/whoami`, { headers }),
    justMe ? { json: () => null } : fetch(pageDataUrl, { headers }),
  ]);

  const [myData, pageData] = await Promise.all([
    myResponse.json(),
    pageResponse.json(),
  ]);

  // 1. Prepare me
  const me = prepareMe(myData);

  // 1.5. Return early on failure
  if (!pageResponse.ok) {
    // Userpage response failed (we receive 404 and send 200), or
    // Didn't proxy the page data but still send `me`
    if (username || justMe) {
      const users = me.id ? { [me.id]: me } : {};
      return { me, attachments: {}, comments: {}, feeds: {}, posts: {}, users };
    }

    // Postpage response failed (we receive 403/404/other and send 200)
    if (postId) {
      const posts = { [postId]: { errorCode: pageResponse.status, errorMessage: pageData.err } };
      const users = me.id ? { [me.id]: me } : {};
      return { me, attachments: {}, comments: {}, feeds: {}, posts, users };
    }

    // Other failures (we send 500)
    throw new Error(pageData.err);
  }

  // 2. Prepare page data (except users)
  const attachments = keyByIdAndMap(pageData.attachments, formatAttachment);
  const comments = keyByIdAndMap(pageData.comments, formatComment);
  const feeds = keyByIdAndMap(pageData.subscriptions);
  const posts = keyByIdAndMap(Array.isArray(pageData.posts) ? pageData.posts : [ pageData.posts ], formatPost);

  // 3. Prepare users (only pick required ones)
  const users = pickRequiredUsers(pageData, username);

  if (me.id) {
    // 4. Add me to users
    users[me.id] = users[me.id] || me;

    // 5. Add amISubscribed property to users
    addSubscriptionInfoToUsers(users, myData);
  }

  return { me, attachments, comments, feeds, posts, users };
};
