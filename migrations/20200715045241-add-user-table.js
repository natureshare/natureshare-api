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
    return db.createTable('user', {
        created_at: 'timestamp',
        updated_at: 'timestamp',
        name: { type: 'string', notNull: true, unique: true, primaryKey: true },
        salt: 'string',
        hash: 'string',
        data: 'jsonb',
    });
};

exports.down = function (db) {
    return db.dropTable('user');
};

exports._meta = {
    version: 1,
};
