/* global process URL */

import fetch from 'node-fetch';
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

export default ({ app, db }) => {
    const feed = ({ rows, path, after }) => ({
        version: 'https://jsonfeed.org/version/1',
        title: 'Actions',
        description: '',
        home_page_url: process.env.APP_HOST,
        feed_url: new URL(path, process.env.API_HOST).href,
        items: rows.map(
            ({
                uuid: id,
                created_at: createdAt,
                deleted_at: deletedAt,
                sender,
                recipient,
                action,
                target,
                data,
            }) => ({
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
                date_published: createdAt,
                date_modified: deletedAt || createdAt,
                _meta: {
                    recipient,
                    target,
                },
            }),
        ),
        _meta: {
            itemCount: rows.length,
            after,
        },
    });

    const workflowDispatch = () => {
        if (process.env.WORKFLOW_REPO && process.env.WORKFLOW_TOKEN) {
            fetch(`https://api.github.com/repos/${process.env.WORKFLOW_REPO}/dispatches`, {
                headers: {
                    Accept: 'application/vnd.github.everest-preview+json',
                    Authorization: `token ${process.env.WORKFLOW_TOKEN}`,
                },
                method: 'POST',
                body: JSON.stringify({ event_type: 'api-actions' }),
            })
                .then((r) => console.log('Workflow dispatch: ', r.status))
                .catch(console.error);
        }
    };

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
                                    .then(() => {
                                        db.query(
                                            'SELECT count(*) FROM public.actions WHERE deleted_at IS NULL',
                                        )
                                            .then((r) => {
                                                if (r.rows[0].count === '1') {
                                                    workflowDispatch();
                                                }
                                            })
                                            .catch(() => {});

                                        response.send({
                                            message:
                                                'Saved. Changes may take up to a day to appear on the website.',
                                        });
                                    })
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

    app.get('/actions', (request, response) => {
        const after = moment(request.query.after).toISOString(true);
        db.query(
            'SELECT * FROM public.actions WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 100',
        )
            .then((result) => {
                response.send(feed({ rows: result.rows, path: request.path, after }));
            })
            .catch((e) => {
                console.error(e);
                response.status(500).send({ errors: { error: ['unknown'] } });
            });
    });

    app.get('/actions/:uuid', (request, response) => {
        db.query('SELECT * FROM public.actions WHERE uuid = $1', [request.params.uuid])
            .then((result) => {
                response.send(feed({ rows: result.rows, path: request.path, after: null }));
            })
            .catch((e) => {
                console.error(e);
                response.status(500).send({ errors: { error: ['unknown'] } });
            });
    });

    app.delete('/actions/:uuid', (request, response) => {
        if (
            request.headers.authorization === `API_TOKEN ${process.env.API_TOKEN}` ||
            request.query.API_TOKEN === process.env.API_TOKEN
        ) {
            db.query('DELETE FROM public.actions WHERE deleted_at <= $1', [
                moment().subtract(7, 'days').toISOString(),
            ])
                .then(() => {})
                .catch(console.error);

            db.query('UPDATE public.actions SET deleted_at = $1 WHERE uuid = $2', [
                moment().toISOString(),
                request.params.uuid,
            ])
                .then(() => {
                    response.send({});
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
};
