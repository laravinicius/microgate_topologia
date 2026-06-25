const bcrypt = require('bcrypt');
const db = require('./db');

const password = process.env.ADMIN_PASSWORD || process.argv[2];
if (!password) {
    console.error('Uso: node seed-password.js <senha>');
    console.error('Ou defina a variável ADMIN_PASSWORD');
    process.exit(1);
}

(async () => {
    try {
        const hash = await bcrypt.hash(password, 8);
        await db.query(
            'INSERT INTO app_config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
            ['admin_password_hash', hash, hash]
        );
        console.log('Senha armazenada com sucesso.');
    } catch (error) {
        if (error.message.includes('doesn\'t exist')) {
            console.error('Tabela app_config não existe. Execute primeiro:');
            console.error('  CREATE TABLE app_config (`key` VARCHAR(50) NOT NULL PRIMARY KEY, `value` TEXT NOT NULL);');
        } else {
            console.error('Erro:', error.message);
        }
    } finally {
        await db.end();
    }
})();
