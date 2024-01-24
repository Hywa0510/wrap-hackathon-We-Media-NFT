// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./NFT.sol";

contract NFTMarket is IERC721Receiver {
    using Address for address; // 使用Address库，用isContract来判断地址是否为合约

    ERC20 public erc20;
    address private owner;

    bytes4 internal constant MAGIC_ON_ERC721_RECEIVED = 0x150b7a02;
    
    //nft订单
    struct Order {
        address seller;
        NFT nft;
        uint256 tokenId;
        uint256 price;
    }

    //nft热度
    struct NFTPopularity {
        NFT nft;
        uint256 popularity;
    }

    //签约信息
    struct Signing {
        address creator;//创作者
        uint256 signingAmount;//签约金额 
        uint256 signingExpiration;//签约到期时间
    }

    //推广信息
    struct PopularizeInfo {
        uint256 popularizeNum;//推广次数
        uint256 popularizeAmount;//推广热度数量
    }

    uint256 public popularityPrice = 10; //默认热度价格为1个token买10点热度
    uint256 public penalty = 3000; //违约金默认为3000
    Order[] public orders;
    NFTPopularity[] public nftLeaderBoard;//nft热度排行榜
    NFT[] public NFTList;
    Signing[] public applyForSigningList;//申请签约的创作者列表
    Signing[] public signedList;//已签约创作者列表
    mapping(NFT => mapping(uint256 => Order)) public idToOrder; // token id to order
    mapping(NFT => mapping(uint256 => uint256)) public idToOrderIndex; // tokenid to order index
    mapping(string => address) private nftNameToNftAddress; 
    mapping(NFT => uint256) public nftToPopularity;//nft的热度
    mapping(NFT => uint256[]) public nftToAllOrderIndex; //nft的所有订单索引
    mapping(uint256 => uint256) private orderIndexToNFTAllOrderListIndex;
    mapping(NFT => bool) private isNFTPlaced;
    mapping(address => bool) public isApplyForSigning; //是否已经申请签约
    mapping(address => uint256) public addrToSigningApplyIndex;
    mapping(address => bool) public isSigned;//是否被签约
    mapping(NFT => PopularizeInfo) public nftToPopularizeInfo;//nft的推广信息
    mapping(address => Signing) public addrToSigningInfo;//已签约的创作者的签约信息
    mapping(address => uint256) public addrToSignedListIndex;//地址查询已签约列表索引
    mapping(address => Signing) private addrToPlatformInviteSigning;//查询平台邀请签约信息

    event Deal(address buyer, address seller, NFT nft, uint256 tokenId, uint256 price);
    event NewOrder(address seller, NFT nft, uint256 tokenId, uint256 price);
    event CancelOrder(address seller, NFT nft,uint256 tokenId);
    event ChangePrice(
        address seller,
        NFT nft,
        uint256 tokenId,
        uint256 previousPrice,
        uint256 price
    );

    constructor(ERC20 _erc20) {
        require(
            address(_erc20) != address(0),
            "Market: ERC20 contract address must be non-null"
        );
        erc20 = _erc20;
        owner = msg.sender;
    }

    //创建NFT
    function createNFT(string memory _name, string memory _symbol) public returns(address nftAddress){
        require(nftNameToNftAddress[_name] == address(0),"this name has already created!");
        NFT nft = new NFT(_name,_symbol,msg.sender);
        nftNameToNftAddress[_name] = address(nft);
        nftAddress = address(nft);
    }

    //由nft名字获取nft地址
    function getNFTAddress(string memory _name) public view returns(address){
        require(nftNameToNftAddress[_name] != address(0),"nft is not exist!");
        return nftNameToNftAddress[_name];
    }

    //购买nft
    function buy(NFT nft, uint256 _tokenId, uint256 _price) external {
        Order memory order = orders[idToOrderIndex[nft][_tokenId]];
        require(_price >= order.price,"your price is not enough!");
        require(erc20.balanceOf(msg.sender) >= _price,"your balance is not enough!");
        nft.safeTransferFrom(address(this),msg.sender,_tokenId);
        if((isSigned[nft.creator()] == true) && (addrToSigningInfo[nft.creator()].signingExpiration > block.timestamp)){
            erc20.transferFrom(msg.sender,order.seller,_price * 697 / 1000);//卖家签约后收益与平台七三分成
            erc20.transferFrom(msg.sender,address(this),_price * 303 / 1000); //平台收取0.3%的手续费
        }else{
            erc20.transferFrom(msg.sender,order.seller,_price * 997 / 1000);
            erc20.transferFrom(msg.sender,address(this),_price * 3 / 1000); //平台收取0.3%的手续费
        }
        removeOrder(nft,_tokenId);
        nftToPopularity[nft] += 1;
        emit Deal(msg.sender, order.seller, nft, _tokenId, _price);
    }

    //取消订单
    function cancelOrder(NFT nft, uint256 _tokenId) external {
        require(msg.sender == idToOrder[nft][_tokenId].seller,"you aren't owner of the order!");
        require(isListed(nft,_tokenId) == true,"your token is not place!");
        nft.safeTransferFrom(address(this),idToOrder[nft][_tokenId].seller,_tokenId);
        removeOrder(nft,_tokenId);
        emit CancelOrder(msg.sender, nft,_tokenId);
    }

    //修改订单价格
    function changePrice(NFT nft, uint256 _tokenId, uint256 _price) external {
        require(isListed(nft,_tokenId) == true,"the token is not place!");
        require(msg.sender == idToOrder[nft][_tokenId].seller,"you aren't owner of the token!");
        uint256 previousPrice = idToOrder[nft][_tokenId].price;
        orders[idToOrderIndex[nft][_tokenId]].price = _price;
        idToOrder[nft][_tokenId] = orders[idToOrderIndex[nft][_tokenId]];
        emit ChangePrice(idToOrder[nft][_tokenId].seller, nft, _tokenId, previousPrice, _price);
    }

    function onERC721Received(
        address _operator,
        address _seller,
        uint256 _tokenId,
        bytes calldata _data
    ) public override returns (bytes4) {
        require(msg.sender.isContract() == true,"only contract called");
        require(_operator != address(0));
        uint256 price = toUint256(_data,0);
        emit NewOrder(_seller, NFT(msg.sender), _tokenId, price);
        return MAGIC_ON_ERC721_RECEIVED;
    }

    function isListed(NFT nft, uint256 _tokenId) public view returns (bool) {
        return idToOrder[nft][_tokenId].seller != address(0);
    }

    function getOrderLength() public view returns (uint256) {
        return orders.length;
    }

    //上架订单
    function placeOrder(NFT nft, uint256 tokenId, uint256 price) public {
        require(isListed(nft,tokenId) == false,"token is already placed!");
        nft.safeTransferFrom(msg.sender,address(this),tokenId,uint256ToBytes(price));
        _placeOrder(msg.sender,nft,tokenId,price);
    }

    function _placeOrder(
        address _seller,
        NFT nft,
        uint256 _tokenId,
        uint256 _price
    ) internal {
        Order memory order = Order(_seller,nft,_tokenId,_price);
        orders.push(order);
        idToOrder[nft][_tokenId] = order;
        idToOrderIndex[nft][_tokenId] = orders.length - 1;
        nftToAllOrderIndex[nft].push(orders.length - 1);
        orderIndexToNFTAllOrderListIndex[orders.length - 1] = nftToAllOrderIndex[nft].length - 1;
        addNFTPlacedList(nft);
        isNFTPlaced[nft] = true;
        emit NewOrder(_seller, nft, _tokenId, _price);
    }

    //将上架过的nft添加进列表
    function addNFTPlacedList(NFT nft) private {
        if(isNFTPlaced[nft] == true){
            return;
        }else{
            NFTList.push(nft);
        }
    }

    //移除订单
    function removeOrder(NFT nft,uint256 _tokenId) internal {
        require(isListed(nft,_tokenId) == true);
        if(idToOrderIndex[nft][_tokenId] == (orders.length-1)){
            orders.pop();
        }else{
            orders[idToOrderIndex[nft][_tokenId]] = orders[orders.length-1];
            idToOrderIndex[nft][orders[orders.length-1].tokenId] = idToOrderIndex[nft][_tokenId];
            orders.pop();
        }
        uint256 orderIndex = idToOrderIndex[nft][_tokenId];
        uint256 nftOrderIndex = orderIndexToNFTAllOrderListIndex[orderIndex];
        uint256 nftLastOrderIndex = nftToAllOrderIndex[nft][nftToAllOrderIndex[nft].length-1];
        if(nftOrderIndex == nftLastOrderIndex){
            nftToAllOrderIndex[nft].pop();
        }else{
            nftToAllOrderIndex[nft][nftOrderIndex] = nftLastOrderIndex;
            orderIndexToNFTAllOrderListIndex[nftLastOrderIndex] = nftOrderIndex;
            nftToAllOrderIndex[nft].pop();
        }
        delete orderIndexToNFTAllOrderListIndex[orderIndex];
        delete idToOrder[nft][_tokenId];
        delete idToOrderIndex[nft][_tokenId];
    }

    //查看订单信息
    function getOrderInfo(uint256 orderIndex) public view returns(
        address seller, NFT nft, uint256 tokenId, uint256 price
    ) {
        require(orders.length > 0,"orders empty");
        require(orderIndex <= orders.length - 1,"orderIndex is not exist");
        Order memory order = orders[orderIndex];
        seller = order.seller;
        nft = order.nft;
        tokenId = order.tokenId;
        price = order.price;
    }

    //更新nft热度排行榜
    function updateNFTLeaderBoard() public {
        delete nftLeaderBoard;
        for(uint256 i = 0; i < NFTList.length; i++){
            NFTPopularity memory nftPopularity = NFTPopularity(NFTList[i],nftToPopularity[NFTList[i]]);
            nftLeaderBoard.push(nftPopularity);
        }
        for(uint256 i = 0; i < nftLeaderBoard.length - 1; i++){
            for(uint256 j = 0; j < nftLeaderBoard.length - i - 1; j++){
                if(nftLeaderBoard[j].popularity < nftLeaderBoard[j+1].popularity){
                    NFTPopularity memory nftPopularity = nftLeaderBoard[j];
                    nftLeaderBoard[j] = nftLeaderBoard[j+1];
                    nftLeaderBoard[j+1] = nftPopularity;
                }
            }
        }
    }

    //获取nft热度排行榜
    function getNFTLeaderBoard(uint256 nftNum) public view returns(
        NFT nft,
        uint256 popularity
        ) {
        require(nftNum <= nftLeaderBoard.length - 1,"nftNum error!");
        return (nftLeaderBoard[nftNum].nft,nftLeaderBoard[nftNum].popularity);
    }
    
    //购买nft热度
    function buyNFTPopularity(NFT nft, uint256 purchaseAmount) public {
        erc20.transferFrom(msg.sender,address(this),purchaseAmount);
        nftToPopularity[nft] += purchaseAmount * popularityPrice;
    }

    //修改nft热度价格
    function changePopularityPrice(uint256 price) public {
        require(msg.sender == owner,"you are not owner!");
        popularityPrice = price;
    }

    //修改违约金
    function changePenalty(uint256 _penalty) public {
        require(msg.sender == owner,"you aren't owner!");
        penalty = _penalty;
    }

    //用户向平台申请签约
    function applyForSigning(uint256 signingAmount, uint256 signingExpiration) public {
        require(isSigned[msg.sender] == false,"you have been signed!");
        require(isApplyForSigning[msg.sender] == false,"you have applied!");
        require(signingExpiration > block.timestamp + 2592000,"at least signing for 30 day!");
        isApplyForSigning[msg.sender] = true;
        Signing memory signing = Signing(msg.sender,signingAmount,signingExpiration);
        applyForSigningList.push(signing);
        addrToSigningApplyIndex[msg.sender] = applyForSigningList.length - 1;
    }

    //平台邀请用户签约 
    function platformInviteSigning(
        address creator, 
        uint256 signingAmount, 
        uint256 signingExpiration
        ) public {
        require(msg.sender == owner,"you aren't owner!");
        require(signingExpiration > block.timestamp + 2592000,"at least signing for 30 day!");
        require(isSigned[creator] == false,"creator has signed!");
        require(addrToPlatformInviteSigning[creator].creator == address(0),"creator had been invited!");
        addrToPlatformInviteSigning[creator] = Signing(creator,signingAmount,signingExpiration);
        erc20.transferFrom(msg.sender, address(this), signingAmount);
    }

    //查看平台邀请信息
    function checkForInviteInfo() public view returns(
        uint256 signingAmount,
        uint256 signingExpiration
        ) {
        require(addrToPlatformInviteSigning[msg.sender].creator == msg.sender,"you haven't been invited!");
        signingAmount = addrToPlatformInviteSigning[msg.sender].signingAmount;
        signingExpiration = addrToPlatformInviteSigning[msg.sender].signingExpiration;
    }

    //用户管理平台邀请签约
    function userManageSigningInvite(bool result) public {
        require(addrToPlatformInviteSigning[msg.sender].creator == msg.sender,"you haven't been invited!");
        uint256 signingAmount = addrToPlatformInviteSigning[msg.sender].signingAmount;
        if(result == true){
            signedList.push(addrToPlatformInviteSigning[msg.sender]);
            isSigned[msg.sender] = true;
            addrToSigningInfo[msg.sender] = addrToPlatformInviteSigning[msg.sender];
            addrToSignedListIndex[msg.sender] = signedList.length - 1;
            erc20.transfer(msg.sender,signingAmount);//如果签约成功向创作者支付签约费
        }else{
            erc20.transfer(owner, signingAmount);
        }
        delete addrToPlatformInviteSigning[msg.sender];
    }

    //平台管理用户申请签约
    function platformManageSigning(address addr,bool result) public {
        require(isApplyForSigning[addr] == true,"user not apply");
        require(msg.sender == owner,"you are not owner!");
        uint256 index = addrToSigningApplyIndex[addr];
        uint256 lastIndex = applyForSigningList.length - 1;
        if(result == true){
            signedList.push(applyForSigningList[index]);
            isSigned[addr] = true;
            addrToSigningInfo[addr] = applyForSigningList[index];
            addrToSignedListIndex[addr] = signedList.length - 1;
            uint256 signingAmount = applyForSigningList[index].signingAmount;
            erc20.transferFrom(owner,addr,signingAmount);//如果签约成功向创作者支付签约费
        }
        if(index == lastIndex){
            applyForSigningList.pop();
        }else{
            applyForSigningList[index] = applyForSigningList[lastIndex];
            addrToSigningApplyIndex[applyForSigningList[lastIndex].creator] = addrToSigningApplyIndex[addr];
            applyForSigningList.pop();
        }
        isApplyForSigning[addr] = false;
        delete addrToSigningApplyIndex[addr];
    }

    //提现合约所有余额到owner账户
    function withdraw() public {
        require(msg.sender == owner,"you are not owner!");
        uint256 balance = erc20.balanceOf(address(this));
        erc20.transfer(msg.sender,balance);
    }

    //平台推广
    function platformPopularize(NFT nft,uint256 popularity) public {
        require(msg.sender == owner,"you are not owner!");
        require(isSigned[nft.creator()] == true, "creator haven't been signed!");
        require(addrToSigningInfo[nft.creator()].signingExpiration > block.timestamp,"signing has expired!");
        nftToPopularity[nft] += popularity;
        nftToPopularizeInfo[nft].popularizeNum += 1;
        nftToPopularizeInfo[nft].popularizeAmount += popularity;
    }

    //用户取消签约,签约到期前解约需要支付违约金
    function userCancelSigning() public {
        require(isSigned[msg.sender] == true,"you haven't been signed!");
        if(addrToSigningInfo[msg.sender].signingExpiration > block.timestamp){
            erc20.transferFrom(msg.sender,address(this),penalty);
        }
        removeSignedList(msg.sender);
    }

    //平台取消签约
    function platformCancelSigning(address addr) public {
        require(msg.sender == owner,"you aren't owner!");
        require(isSigned[addr] == true,"user didn't signing");
        removeSignedList(addr);
    }

    //移除已签约列表
    function removeSignedList(address addr) private {
        uint256 index = addrToSignedListIndex[addr];
        uint256 lastIndex = signedList.length - 1;
        address lastAddress = signedList[lastIndex].creator;
        signedList[index] = signedList[lastIndex];
        addrToSignedListIndex[lastAddress] = addrToSignedListIndex[addr];
        signedList.pop();
        isSigned[addr] = false;
        delete addrToSignedListIndex[addr];
        delete addrToSigningInfo[addr];
    }

    // https://stackoverflow.com/questions/63252057/how-to-use-bytestouint-function-in-solidity-the-one-with-assembly
    function toUint256(bytes memory _bytes, uint256 _start)
        internal
        pure
        returns (uint256)
    {
        require(_start + 32 >= _start, "Market: toUint256_overflow");
        require(_bytes.length >= _start + 32, "Market: toUint256_outOfBounds");
        uint256 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
        }

        return tempUint;
    }

    function uint256ToBytes(uint256 number) private pure returns (bytes memory) {
        return abi.encodePacked(number);
    }   
}