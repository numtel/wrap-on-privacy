pragma circom 2.1.5;

include "poseidon.circom";

// From https://rubydusa.medium.com/symmetric-encryption-in-circom-53137de2a011

template SymmetricEncrypt() {
    signal input message;  // private
    signal input key;  // private
    signal input nonce;  // public

    signal output encryptedMessage;

    component hasher = Poseidon(2);

    hasher.inputs[0] <== key;
    hasher.inputs[1] <== nonce;

    encryptedMessage <== hasher.out + message;
}

template SymmetricDecrypt() {
    signal input encryptedMessage; // public
    signal input key;  // private
    signal input nonce; // public

    signal output message;

    component hasher = Poseidon(2);

    hasher.inputs[0] <== key;
    hasher.inputs[1] <== nonce;

    message <== encryptedMessage - hasher.out;
}
