/* global process URL */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

fetch(new URL('/actions?after=0', process.env.API_HOST))
    .then((response) => {
        if (response.ok) {
            response.json()
                .then((feed => {
                    feed.items.forEach((item) => {
                        console.log(item.author.name, item.title, item.url);
                        fetch(
                            item.url,
                            {
                                headers: {
                                    Authorization: `API_TOKEN ${process.env.API_TOKEN}`,
                                },
                                method: 'DELETE',
                            }
                        ).then((r) => console.log(' -->', r.status)).catch(console.error);
                    });
                }))
                .catch(console.error);
        }
    })
    .catch(console.error);


