// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../contracts/IScaledERC20.sol";

contract MockAToken is IScaledERC20 {
    uint256 public override totalSupply;
    uint256 public override scaledTotalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    string public name = "Mock AToken";
    string public symbol = "MAT";
    uint8 public decimals = 18;

    function mint(uint256 amount) external {
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
    }

    function setScaledTotalSupply(uint256 _scaledTotalSupply) external {
        scaledTotalSupply = _scaledTotalSupply;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
