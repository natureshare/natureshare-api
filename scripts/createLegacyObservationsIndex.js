import Path from 'path';
import Glob from 'glob';
import FS from 'fs';

const cwd = Path.join('..', 'natureshare-files');

const index = {};

Glob.sync(Path.join('*', 'items', 'ns', '*', '*.yaml'), { cwd }).forEach((f) => {
    // console.log(f);
    index[Path.basename(f, '.yaml')] = Path.dirname(f);
});

FS.writeFileSync(
    'legacyObservationsIndex.json',
    JSON.stringify(index, null, 1)
);
