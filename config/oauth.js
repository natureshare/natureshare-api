/* global process */

import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

export default {
    google: {
        key: process.env.OAUTH_GOOGLE_KEY,
        secret: process.env.OAUTH_GOOGLE_SECRET,
        // https://developers.google.com/identity/protocols/oauth2/scopes
        scope: [
            'openid',
            'email',
            'https://www.googleapis.com/auth/photoslibrary.readonly',
            'https://www.googleapis.com/auth/youtube.readonly',
        ],
        nonce: true,
        custom_params: {
            access_type: "offline",
            prompt: "select_account",
        },
    },
    flickr: {
        key: process.env.OAUTH_FLICKR_KEY,
        secret: process.env.OAUTH_FLICKR_SECRET,
        scope: ['read'],
    },
    dropbox: {
        key: process.env.OAUTH_DROPBOX_KEY,
        secret: process.env.OAUTH_DROPBOX_SECRET,
    },
    vimeo: {
        key: process.env.OAUTH_VIMEO_KEY,
        secret: process.env.OAUTH_VIMEO_SECRET,
        scope: 'public',
    },
    facebook: {
        key: process.env.OAUTH_FACEBOOK_KEY,
        secret: process.env.OAUTH_FACEBOOK_SECRET,
        scope: 'user_photos user_videos',
    },
    instagram: {
        key: process.env.OAUTH_INSTAGRAM_KEY,
        secret: process.env.OAUTH_INSTAGRAM_SECRET,
        scope: 'user_profile user_media',
    },
    inaturalist: {
        key: process.env.OAUTH_INATURALIST_KEY,
        secret: process.env.OAUTH_INATURALIST_SECRET,
        authorize_url: 'https://www.inaturalist.org/oauth/authorize',
        access_url: 'https://www.inaturalist.org/oauth/token',
        oauth: 2,
    }
};
