pragma circom 2.1.5;

include "bitify.circom";

// From https://github.com/Shigoto-dev19/classic-elgamal-circom/blob/master/circuits/exponentiate.circom

template Exponentiate() {
    signal input base;
    signal input exponent;
    signal output out;

    
    // 2^253 already overflows 253-bit unsigned integer; the possible maximum exponent value is 252 
    // Since 2**253 can be described inside the circom integer range(the circom prime number is larger than 2**253),
    // 253 should be set as maximum value for other usages(SAR, etc) --> not secure for cryptographic algorithms

    var NUM_BITS = 254;
    signal exp[NUM_BITS];
    signal inter[NUM_BITS];
    signal temp[NUM_BITS]; // Used to detour a non-quadratic constraint error.

    component exponentBits = Num2Bits(NUM_BITS);
    exponentBits.in <== exponent;

    exp[0] <== base;
    inter[0] <== 1;
    for (var i = 0; i < NUM_BITS; i++) {
        temp[i] <== exponentBits.out[i] * exp[i] + (1 - exponentBits.out[i]); // exponent_bin[i] == 1 ? 2^(i+1) : 1
        if (i < NUM_BITS - 1) {
            inter[i + 1] <== inter[i] * temp[i];
            exp[i + 1] <== exp[i] * exp[i];
        } else {
            out <== inter[i] * temp[i];
        }
    }
}
