// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFT is ERC721 {
    uint public MAX_CBIS = 100; // 总量
    address public creator; //nft创造者
    mapping(uint => string) public idToURL;

    constructor(string memory _name, string memory _symbol, address _creator)
        ERC721(_name, _symbol)
    {
        creator = _creator;
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://voidtech.cn/i/2022/11/20/nwjv7t.jpeg";
    }

    function mint(address to, uint tokenId,string memory URL) external {
        require(tokenId >= 0 && tokenId < MAX_CBIS, "tokenId out of range");
        _mint(to, tokenId);
        idToURL[tokenId] = URL;
    }
}