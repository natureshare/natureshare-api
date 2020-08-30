/* global process URL */

import moment from 'moment';
import yaml from 'js-yaml';
import { v4 as uuid } from 'uuid';
import { getUsername } from './utils/auth.js';

const collectionNameFormat = /^[a-z0-9_-]{3,}$/;

const validators = {
    itemComment: ({ comment }) => {
        if (!comment || typeof comment !== 'string') {
            return { errors: { comment: ['required'] } };
        }
        if (comment.length > 1000) {
            return { errors: { comment: ['too long'] } };
        }
        return { data: { comment } };
    },
    itemToCollection: ({ collection }) => {
        if (!collection || typeof collection !== 'string') {
            return { errors: { collection: ['required'] } };
        }
        if (collection.length < 3) {
            return { errors: { collection: ['too short'] } };
        }
        if (!collectionNameFormat.test(collection)) {
            return { errors: { collection: ['not valid'] } };
        }
        return { data: { collection } };
    },
    runUserMediaImport: () => {
        return { data: {} };
    },
};

const rateLimits = {
    itemComment: [100, 1, 'day'],
    itemToCollection: [100, 1, 'day'],
    runUserMediaImport: [1, 2, 'hours', true],
};

const feed = ({ rows, path, after }) => ({
    version: 'https://jsonfeed.org/version/1',
    title: 'Actions',
    description: '',
    home_page_url: process.env.APP_HOST,
    feed_url: new URL(path, process.env.API_HOST).href,
    items: rows.map(({ uuid: id, created_at: date, sender, recipient, action, target, data }) => ({
        id,
        url: new URL(`${path}/${id}`, process.env.API_HOST).href,
        title: action,
        author: {
            name: sender,
            url: new URL(
                `/profile?i=${encodeURIComponent(`./${recipient}/actions`)}`,
                process.env.APP_HOST,
            ).href,
        },
        content_text: yaml.safeDump(data),
        date_published: date,
        date_modified: date,
        _meta: {
            recipient,
            target,
        },
    })),
    _meta: {
        itemCount: rows.length,
        after,
    },
});

export default ({ app, db }) => {
    app.get('/actions', (request, response) => {
        const after = moment(request.query.after).toISOString(true);
        db.query(
            'SELECT * FROM public.actions WHERE created_at > $1 ORDER BY created_at ASC LIMIT $2',
            [after, request.query.limit || 100],
        )
            .then((result) => {
                response.send(feed({ rows: result.rows, path: request.path, after }));
            })
            .catch((e) => {
                console.error(e);
                response.status(500).send({ errors: { error: ['unknown'] } });
            });
    });

    app.post('/actions', (request, response) => {
        const sender = getUsername(request);
        if (!sender) {
            response.status(422).send({ errors: { log_in: ['required'] } });
        } else {
            const { recipient, url, action, target, ...unfilteredData } = request.body.action;
            if (!action) {
                response.status(422).send({ errors: { action: ['required'] } });
            } else if (!target) {
                response.status(422).send({ errors: { target: ['required'] } });
            } else if (!(action in validators)) {
                response.status(422).send({ errors: { action: ['unknown'] } });
            } else {
                const [limit, duration, unit, scopeTarget] = rateLimits[action] || [
                    1000,
                    1,
                    'day',
                    false,
                ];
                db.query(
                    `SELECT count(*) FROM public.actions WHERE created_at > $1 AND action = $2 AND sender = $3 ${
                        scopeTarget ? 'AND target = $4' : ''
                    }`,
                    [
                        moment().subtract(duration, unit),
                        action,
                        sender,
                        ...(scopeTarget ? [target] : []),
                    ],
                )
                    .then((result) => {
                        if (result.rows[0].count >= limit) {
                            response.status(422).send({
                                errors: {
                                    action: [
                                        `rate limit exceeded (please wait ${duration} ${unit} and try again)`,
                                    ],
                                },
                            });
                        } else {
                            const { data, errors } = validators[action](unfilteredData);
                            if (errors) {
                                response.status(422).send({ errors });
                            } else {
                                db.query(
                                    'INSERT INTO public.actions(uuid, created_at, sender, recipient, url, action, target, data) VALUES($1, $2, $3, $4, $5, $6, $7, $8)',
                                    [
                                        uuid(),
                                        moment(),
                                        sender,
                                        recipient || sender,
                                        url,
                                        action,
                                        target,
                                        data,
                                    ],
                                )
                                    .then(() =>
                                        response.send({
                                            message:
                                                'Saved. Changes may take up to a day to appear on the website.',
                                        }),
                                    )
                                    .catch(() =>
                                        response
                                            .status(422)
                                            .send({ errors: { error: ['unknown'] } }),
                                    );
                            }
                        }
                    })
                    .catch(() => response.status(422).send({ errors: { error: ['unknown'] } }));
            }
        }
    });

    ['get', 'delete'].forEach((method) => {
        app[method]('/actions/:uuid', (request, response) => {
            if (
                method === 'get' ||
                request.headers.authorization === `API_TOKEN ${process.env.API_TOKEN}` ||
                request.query.API_TOKEN === process.env.API_TOKEN
            ) {
                db.query(
                    method === 'delete'
                        ? 'DELETE FROM public.actions WHERE uuid = $1 RETURNING *'
                        : 'SELECT * FROM public.actions WHERE uuid = $1',
                    [request.params.uuid],
                )
                    .then((result) => {
                        response.send(feed({ rows: result.rows, path: request.path, after: null }));
                    })
                    .catch((e) => {
                        console.error(e);
                        response.status(500).send({ errors: { error: ['unknown'] } });
                    });
            } else {
                response
                    .status(403) // Forbidden
                    .send({ errors: { API_TOKEN: ['mismatch'] } });
            }
        });
    });

    if (process.env.NODE_ENV !== 'production') {
        app.delete('/actions/pop', (request, response) => {
            const after = moment(request.query.after).toISOString(true);
            db.query(
                'DELETE FROM public.actions WHERE uuid IN (SELECT uuid FROM public.actions WHERE created_at > $1 ORDER BY created_at ASC LIMIT 1) RETURNING *',
                [after],
            )
                .then((result) => {
                    response.send(feed({ rows: result.rows, path: request.path, after: null }));
                })
                .catch((e) => {
                    console.error(e);
                    response.status(500).send({ errors: { error: ['unknown'] } });
                });
        });

        app.get('/actions/delete/all', (request, response) => {
            db.query('DELETE FROM public.actions RETURNING *')
                .then((result) => {
                    response.send(feed({ rows: result.rows, path: request.path, after: null }));
                })
                .catch((e) => {
                    console.error(e);
                    response.status(500).send({ errors: { error: ['unknown'] } });
                });
        });
    }
};
