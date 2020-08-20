import crypto from 'crypto';
import moment from 'moment';
import { getUsername, getUsernameFromAuth } from './utils/auth.js';
import providers from '../config/oauth.js';

const usernameFormat = /^[a-z]{1}[a-z0-9_-]+[a-z0-9]{1}$/;

const forbiddenUsernames = [
    'admin',
    'root',
    'superuser',
    'test',
    'testing',
    'ns',
    'natureshare',
    'all',
];

const passwordDigest = ({ password }) => {
    const salt = crypto.randomBytes(12).toString('base64');
    const hash = crypto.createHash('sha256').update(`${salt}${password}`).digest('base64');
    return { salt, hash };
};

export default ({ app, db }) => {
    app.get('/user', (request, response) => {
        if (request.headers.authorization)
            request.session.authorization = request.headers.authorization;
        const username = getUsernameFromAuth(request.session.authorization);
        if (username) {
            request.session.username = username;
            db.query('SELECT name, email, data FROM public.user WHERE name = $1', [username])
                .then((result) => {
                    if (result.rows.length === 0) {
                        response.send({});
                    } else {
                        response.send(result.rows[0]);
                    }
                })
                .catch(console.warn);
        } else {
            response.send({});
        }
    });

    app.post('/user', (request, response) => {
        const { user } = request.body;
        const { username, email, password, password_confirmation: confirmation } = user;
        if (!username || !password || !confirmation) {
            response.status(422).send({
                errors: {
                    ...(username ? {} : { username: ['required'] }),
                    ...(password ? {} : { password: ['required'] }),
                    ...(confirmation ? {} : { password_confirmation: ['required'] }),
                },
            });
        } else if (username.length < 4) {
            response
                .status(422)
                .send({ errors: { username: ['must be longer than 4 characters'] } });
        } else if (username !== username.toLowerCase()) {
            response.status(422).send({ errors: { username: ['must be lower case'] } });
        } else if (!usernameFormat.test(username)) {
            response.status(422).send({
                errors: {
                    username: [
                        'can only contain a-z and 0-9 (with an optional dash or underscore in the middle)',
                    ],
                },
            });
        } else if (forbiddenUsernames.includes(username)) {
            response.status(422).send({ errors: { username: ['not allowed'] } });
        } else if (password !== confirmation) {
            response.status(422).send({ errors: { password_confirmation: ['does not match'] } });
        } else {
            const dbCatch = () =>
                response.status(422).send({ errors: { username: ['not saved'] } });
            db.query('SELECT name, email, data FROM public.user WHERE name = $1', [username])
                .then((result) => {
                    if (result.rows.length === 0) {
                        const { salt, hash } = passwordDigest({ password });
                        db.query(
                            'INSERT INTO public.user(created_at, updated_at, name, email, salt, hash, data) VALUES($1, $2, $3, $4, $5, $6, $7)',
                            [moment(), moment(), username, email, salt, hash, {}],
                        )
                            .then(() => response.send({ message: 'User created. Please log in.' }))
                            .catch(dbCatch);
                    } else {
                        response.status(422).send({ errors: { username: ['already in use'] } });
                    }
                })
                .catch(dbCatch);
        }
    });

    app.patch('/user', (request, response) => {
        const username = getUsername(request);
        if (username && request.body.user) {
            const { user } = request.body;
            if (user.password) {
                if (user.password === user.password_confirmation) {
                    const { salt, hash } = passwordDigest({ password: user.password });
                    db.query(
                        'UPDATE public.user SET updated_at = $2, email = $3, salt = $4, hash = $5 WHERE name = $1',
                        [username, moment(), user.email, salt, hash],
                    )
                        .then(() => response.send({ message: 'Saved' }))
                        .catch(console.warn);
                } else {
                    response
                        .status(422)
                        .send({ errors: { password_confirmation: ['does not match'] } });
                }
            } else {
                db.query('UPDATE public.user SET updated_at = $2, email = $3 WHERE name = $1', [
                    username,
                    moment(),
                    user.email,
                ])
                    .then(() => response.send({ message: 'Saved' }))
                    .catch(console.warn);
            }
        } else {
            response.status(422).send({ errors: { not_logged_in: [''] } });
        }
    });

    // TODO: Make this more abstract:
    Object.keys(providers).forEach((provider) => {
        app.delete(`/user/oauth/${provider}`, (request, response) => {
            const username = getUsernameFromAuth(request.headers.authorization);
            if (username) {
                db.query(
                    `UPDATE public.user SET data = jsonb_set((SELECT data FROM public.user WHERE name = $1 LIMIT 1), '{oauth, ${provider}}', 'null', true), updated_at = $2 WHERE name = $1`,
                    [username, moment()],
                )
                    .then(() => response.send({ message: 'ok' }))
                    .catch(console.error);
            } else {
                response.send({ errors: { username: ['Not logged in.'] } });
            }
        });
    });
};
