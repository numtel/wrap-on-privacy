// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {Script, console2} from "forge-std/Script.sol";

import "../contracts/PrivateToken.sol";

contract Deploy is Script {
  function run() public {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
    vm.startBroadcast(deployerPrivateKey);

    new PrivateToken(vm.envAddress("VERIFIER_ADDRESS"), vm.envAddress("MINT_VERIFIER_ADDRESS"));
  }
}
