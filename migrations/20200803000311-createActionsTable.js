let dbm;
let type;
let seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
    dbm = options.dbmigrate;
    type = dbm.dataType;
    seed = seedLink;
};

exports.up = function (db) {
    return db.createTable('actions', {
        uuid: { type: 'string', primaryKey: true },
        created_at: { type: 'timestamp', notNull: true },
        sender: { type: 'string', notNull: true },
        recipient: { type: 'string', notNull: true },
        url: { type: 'string' },
        action: { type: 'string', notNull: true },
        target: { type: 'string', notNull: true },
        data: 'jsonb',
    });
};

exports.down = function (db) {
    return db.dropTable('actions');
};

exports._meta = {
    version: 1,
};
