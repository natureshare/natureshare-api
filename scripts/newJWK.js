import jose from 'node-jose';

// https://github.com/cisco/node-jose#encrypting-content
// https://github.com/cisco/node-jose/blob/master/test/jwe/jwe-test.js
// https://github.com/ietf-jose/cookbook/blob/master/jwe/5_4.key_agreement_with_key_wrapping_using_ecdh-es_and_aes-keywrap_with_aes-gcm.json

const secret = 'Hello Nobody';

jose.JWK.createKey("EC", "P-384").
    then((key) => {
        // console.log('Preferred encrypt:');
        // console.log(key.algorithms("encrypt"));

        // console.log('Preferred wrap:');
        // console.log(key.algorithms("wrap"));

        console.log('Public:');
        // console.log(key.toJSON());
        const publicKeyJson = JSON.stringify(key.toJSON());
        console.log(publicKeyJson);

        console.log('Private:');
        // console.log(key.toJSON(true));
        const privateKeyJson = JSON.stringify(key.toJSON(true));
        console.log(privateKeyJson);

        jose.JWK.asKey(publicKeyJson).
            then((publicKey) => {
                jose.JWE.createEncrypt(publicKey).
                    update(secret).
                    final().
                    then((encrypted) => {
                        // console.log('Encrypted:');
                        // console.log(encrypted);

                        // console.log('protected:');
                        // console.log(JSON.parse(jose.util.base64url.decode(encrypted.protected)));

                        jose.JWK.asKey(privateKeyJson).
                            then((privateKey) => {
                                jose.JWE.createDecrypt(privateKey).
                                    decrypt(encrypted).
                                    then((decrypted) => {
                                        // console.log('Decrypted:');
                                        // console.log(decrypted);
                                        // console.log(decrypted.plaintext.toString());

                                        if (decrypted.plaintext.toString() !== secret) {
                                            throw Error('Mismatch!');
                                        } else {
                                            console.log('Ok go.');
                                        }
                                    });
                            });
                    });
            });
    });
