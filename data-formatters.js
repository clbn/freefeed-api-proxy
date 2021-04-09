import fetch from 'isomorphic-unfetch';

export const formatAttachment = attachment => {
  if (!attachment) return null;

  const { id, mediaType, fileName, fileSize, imageSizes, thumbnailUrl, url } = attachment;

  if (mediaType !== 'image') {
    return { id, mediaType, url };
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
    id,
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

  return {
    id: comment.id,
    body: comment.body,
    authorId: comment.createdBy,
    createdAt: +comment.createdAt,
  };
};

export const formatPost = post => {
  if (!post) return null;

  return {
    id: post.id,
    body: post.body,
    authorId: post.createdBy,
    createdAt: +post.createdAt,
    recipientFeedIds: post.postedTo,
    attachmentIds: post.attachments,
    likerIds: post.likes,
    omittedLikes: +post.omittedLikes,
    commentIds: post.comments,
    omittedComments: +post.omittedComments,
    areCommentsDisabled: post.commentsDisabled === '1',
  };
};

export const formatUser = (user, full) => {
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
    administrators: user.administrators || [],
  };

  if (full) {
    formattedUser.description = user.description;
  }

  return formattedUser;
};

export const prepareMe = data => {
  let me = {};
  if (data.users) {
    me = formatUser(data.users);
    // Replace info from data.users.subscriptions with info from data.subscriptions
    me.subscriptions = data.subscriptions.map(s => s.user);
  }
  return me;
}

export const pickRequiredUsers = data => {
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
      requiredUsers[u.id] = u;
    }
  });

  // 3.3. Get the rest of required users from data.subscribers
  data.subscribers.forEach(u => {
    if (requiredUsers[u.id] && !requiredUsers[u.id].id) {
      requiredUsers[u.id] = u;
    }
  });

  // 3.4. Convert the users into an array
  return Object.values(requiredUsers);
};

export const loadAndFormat = async (pageDataUrl, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = token;
  }

  const [myResponse, pageResponse] = await Promise.all([
    fetch(`https://freefeed.net/v2/users/whoami`, { headers }),
    fetch(pageDataUrl, { headers }),
  ]);

  const [myData, pageData] = await Promise.all([
    myResponse.json(),
    pageResponse.json(),
  ]);

  if (!pageResponse.ok) {
    throw new Error(pageData.err);
  }

  // 1. Prepare me
  const me = prepareMe(myData);

  // 2. Prepare page data (except users)
  const attachments = pageData.attachments.map(formatAttachment);
  const comments = pageData.comments.map(formatComment);
  const feeds = pageData.subscriptions;
  const posts = Array.isArray(pageData.posts)
    ? pageData.posts.map(formatPost)
    : [ formatPost(pageData.posts) ];

  // 3. Prepare users (only pick required ones)
  const users = pickRequiredUsers(pageData).map(formatUser);

  return { me, attachments, comments, feeds, posts, users };
};
