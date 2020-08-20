/* global process */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export default function auth({ app, db }) {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) throw new Error('No JWT_SECRET!');

    const passwordDigest = (salt, password) =>
        crypto.createHash('sha256').update(`${salt}${password}`).digest('base64');

    app.post('/auth', (request, response) => {
        const { username, password } = request.body;
        db.query('SELECT name, salt, hash FROM public.user WHERE name = $1', [
            username.toLowerCase(),
        ])
            .then((result) => {
                if (result.rows.length === 0) {
                    response.status(422).send({ errors: { username: ['not found'] } });
                } else {
                    const user = result.rows[0];
                    if (user.hash === passwordDigest(user.salt, password)) {
                        response.send({
                            token: jwt.sign({ username }, jwtSecret, { expiresIn: '30d' }),
                        });
                    } else {
                        response.status(422).send({ errors: { password: ['incorrect'] } });
                    }
                }
            })
            .catch(console.warn);
    });

    app.delete('/auth', (request, response) => {
        request.session.destroy(() => response.send({ message: 'ok' }));
    });
}
