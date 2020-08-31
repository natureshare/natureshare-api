/* global process */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

fetch(
    "https://api.github.com/repos/natureshare/natureshare-files/dispatches",
    {
        headers: {
            Accept: "application/vnd.github.everest-preview+json",
            Authorization: `token ${process.env.WORKFLOW_TOKEN}`,
        },
        method: 'POST',
        body: JSON.stringify({ event_type: "api-actions" }),
    }
).then(console.log).catch(console.error);
