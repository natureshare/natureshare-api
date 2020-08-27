/* global URL process */

import grant from 'grant';
import moment from 'moment';
import _mapValues from 'lodash/mapValues.js';
import providers from '../config/oauth.js';
import { getUsernameFromAuth, encrypt } from './utils/auth.js';

export default function connect({ app, db }) {
    app.use(
        grant.express()({
            defaults: {
                origin: `https://${new URL(process.env.API_HOST).host}`,
                transport: 'session',
                state: true,
            },
            ...providers,
        }),
    );

    app.get('/connect-options', (request, response) => {
        if (request.headers.authorization)
            request.session.authorization = request.headers.authorization;
        response.send({
            authorization: request.session.authorization,
            username: getUsernameFromAuth(request.session.authorization),
            providers: _mapValues(
                providers,
                (v, k) => new URL(`/connect/${k}`, process.env.API_HOST).href,
            ),
        });
    });

    Object.keys(providers).forEach((provider) => {
        [
            `/connect/${provider}/callback`,
            process.env.NODE_ENV !== 'production' ? `/connect.dev/${provider}` : null,
        ].forEach((path) => {
            if (path) {
                app.get(path, (request, response) => {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(request.session.grant.response.raw);
                    }
                    const redirect = () =>
                        response.redirect(new URL('/upload', process.env.APP_HOST));
                    const username = getUsernameFromAuth(request.session.authorization);
                    if (username) {
                        encrypt(JSON.stringify(request.session.grant.response.raw || {}))
                            .then((encrypted) => {
                                db.query(
                                    `UPDATE public.user SET data = jsonb_set((SELECT data FROM public.user WHERE name = $1 LIMIT 1), '{oauth, ${provider}}', $2, true), updated_at = $3 WHERE name = $1`,
                                    [username, encrypted, moment()],
                                )
                                    .then(redirect)
                                    .catch(redirect);
                            })
                            .catch(redirect);
                    } else {
                        redirect();
                    }
                });
            }
        });
    });
}
