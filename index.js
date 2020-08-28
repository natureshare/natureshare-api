/* global process */

import express from 'express';
import session from 'express-session';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';
import useragent from 'express-useragent';

import user from './app/user.js';
import users from './app/users.js';
import auth from './app/auth.js';
import actions from './app/actions.js';
import connect from './app/connect.js';
import observations from './app/observations.js';

if (process.env.NODE_ENV !== 'production') {
    dotenv.config();
}

const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
        process.env.POSTGRES_SSL === 'no'
            ? false
            : {
                  rejectUnauthorized: false,
              },
    max: 2,
});

db.query('SELECT COUNT(*) FROM public.migrations')
    .then((result) => console.log('migrations:', result.rows[0].count))
    .catch(console.warn);

/// //////////////////////////////

const app = express();

app.use(express.static('public'));

app.use(useragent.express());

const requestLogger = (request, response, next) => {
    console.log(request.useragent.source);
    console.log(
        '[',
        request.useragent.platform,
        '-',
        request.useragent.browser,
        ']',
        request.method,
        request.path,
    );
    next();
};

app.use(requestLogger);

app.use(
    cors({
        origin: [
            process.env.APP_HOST.replace(/\/$/, ''),
            ...((process.env.APP_HOST_CORS || '').split(',').map(s => s.replace(/\/$/, ''))),
        ],
        credentials: true,
    }),
);

const SessionStore = connectPgSimple(session);

app.use(
    session({
        store: new SessionStore({
            pool: db,
        }),
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
    }),
);

app.use(bodyParser.json());

app.get('/', (request, response) => {
    response.redirect(307, process.env.APP_HOST);
});

user({ app, db });
users({ app, db });
auth({ app, db });
actions({ app, db });
connect({ app, db });
observations({ app });

app.listen(process.env.PORT);
