// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDT is ERC20 {
    constructor() ERC20("USDT", "USDT") {
        _mint(msg.sender, 1 * 10**8 * 10**18);
    }

    function mint(address addr, uint256 amount) public {
        _mint(addr,amount);
    }
}
