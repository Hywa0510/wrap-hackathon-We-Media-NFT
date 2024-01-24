const { ethers } = require("hardhat");
const { expect } = require("chai");
const {time,loadFixture,} = require("@nomicfoundation/hardhat-network-helpers");

describe("NFTMarket contract", function() {

    async function contractDeploy() {
        //获取账户
        const [owner, addr1, addr2] = await ethers.getSigners();
        //部署usdt合约
        const USDT = await ethers.getContractFactory("USDT");
        const usdt = await USDT.deploy();
        await usdt.deployed();
        const usdtAddress = usdt.address;
        //部署nft交易平台
        const NFTMarket = await ethers.getContractFactory("NFTMarket");
        const nftMarket = await NFTMarket.deploy(usdtAddress);
        await nftMarket.deployed();
        const nftMarketAddress = nftMarket.address;
        //owner创建并部署nft1
        await nftMarket.createNFT("hja","hja");
        const nftAddress1 = await nftMarket.getNFTAddress("hja");
        const NFT1 = await ethers.getContractAt("NFT", nftAddress1);
        const nft1 = await NFT1.deployed();
        await nft1.deployed();
        //addr1创建并部署nft2
        await nftMarket.connect(addr1).createNFT("a","a");
        const nftAddress2 = await nftMarket.getNFTAddress("a");
        const NFT2 = await ethers.getContractAt("NFT", nftAddress2);
        const nft2 = await NFT2.deployed();
        await nft2.deployed();
        //addr2创建并部署nft3
        await nftMarket.connect(addr2).createNFT("b","b");
        const nftAddress3 = await nftMarket.getNFTAddress("b");
        const NFT3 = await ethers.getContractAt("NFT", nftAddress3);
        const nft3 = await NFT3.deployed();
        await nft3.deployed();
        return{owner, addr1, addr2, nftMarket, usdt, usdtAddress, nft1, nft2, nft3, nftMarketAddress};
    }
    //上架nft1,nft2和nft3编号为0的nft
    async function placeOrder() {
        const {owner, addr1, addr2, nft1, nft2, nft3} = await loadFixture(contractDeploy);
        const {nftMarket} = await loadFixture(platformAgreeSigning);
        const price = 1000;
        await nft1.mint(owner.address,0,"1");
        await nft1.approve(nftMarket.address,0);
        await nftMarket.placeOrder(nft1.address,0,price);
        await nft2.connect(addr1).mint(addr1.address,0,"1");
        await nft2.connect(addr1).approve(nftMarket.address,0);
        await nftMarket.connect(addr1).placeOrder(nft2.address,0,price);
        await nft3.connect(addr2).mint(addr2.address,0,"1");
        await nft3.connect(addr2).approve(nftMarket.address,0);
        await nftMarket.connect(addr2).placeOrder(nft3.address,0,price);
        return{nft1, nft2, nft3, nftMarket, price};
    }
    //addr1购买nft1编号为0的nft
    async function buyNft() {
        const {addr1, usdt} = await loadFixture(contractDeploy);
        const {nftMarket, nft1} = await loadFixture(placeOrder);
        await usdt.mint(addr1.address,10**10);
        await usdt.connect(addr1).approve(nftMarket.address,10000);
        await nftMarket.connect(addr1).buy(nft1.address, 0, 1000);
        return{usdt, nftMarket, nft1};
    }
    //owner,addr1和addr2申请签约
    async function applyForSigning() {
        const {nftMarket, addr1, addr2} = await loadFixture(contractDeploy);
        const signingAmount = 1000;
        const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60;
        const signingExpiration = await time.latest() + 2 * ONE_MONTH_IN_SECS;
        await nftMarket.connect(addr1).applyForSigning(signingAmount,signingExpiration);
        await nftMarket.applyForSigning(signingAmount,signingExpiration);
        await nftMarket.connect(addr2).applyForSigning(signingAmount,signingExpiration);
        return{nftMarket, signingAmount, signingExpiration};
    }
    //平台同意与owner,addr1和addr2签约
    async function platformAgreeSigning() {
        const {owner, addr1, addr2, usdt} = await loadFixture(contractDeploy);
        const {nftMarket} = await loadFixture(applyForSigning);
        await usdt.approve(nftMarket.address,10**10);
        await nftMarket.platformManageSigning(addr1.address,true);
        await nftMarket.platformManageSigning(addr2.address,true);
        await nftMarket.platformManageSigning(owner.address,true);
        return{nftMarket, usdt};
    }
    //平台邀请addr1签约
    async function platformInviteSigning() {
        const {nftMarket, addr1, usdt} = await loadFixture(contractDeploy);
        const signingAmount = 1000;
        const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60;
        const signingExpiration = await time.latest() + 2 * ONE_MONTH_IN_SECS;
        await usdt.approve(nftMarket.address,10**10);
        await nftMarket.platformInviteSigning(addr1.address, signingAmount, signingExpiration);
        return{nftMarket, signingAmount, signingExpiration};
    }
    //addr1同意签约
    async function userAgreeSigningInvite() {
        const {addr1} = await loadFixture(contractDeploy);
        const {nftMarket} = await loadFixture(platformInviteSigning);
        await nftMarket.connect(addr1).userManageSigningInvite(true);
        return{nftMarket};
    }
    //更新排行榜
    async function updateNFTLeaderBoard() {
        const {nftMarket, nft1, nft2, nft3} = await loadFixture(placeOrder);
        await nftMarket.platformPopularize(nft1.address,10);
        await nftMarket.platformPopularize(nft2.address,30);
        await nftMarket.platformPopularize(nft3.address,20);
        await nftMarket.updateNFTLeaderBoard();
        return{nftMarket, nft1, nft2, nft3};
    }

    it("NFTMarket deploy successfully", async function(){
        const {nftMarket, usdtAddress} = await loadFixture(contractDeploy);
        expect(await nftMarket.erc20()).to.equal(usdtAddress);
    });

    describe("CreateNft", async function() {

        it("Nft1 create successfully", async function() {
            const {nft1, owner} = await loadFixture(contractDeploy);
            expect(await nft1.creator()).to.equal(owner.address);
        });

        it("Can't create the same nft", async function() {
            const {nftMarket} = await loadFixture(contractDeploy);
            await expect(nftMarket.createNFT("hja","hja")).to.be.revertedWith("this name has already created!");
        });

        it("Different address can create different nft", async function() {
            const {nftMarket, addr1} = await loadFixture(contractDeploy);
            await nftMarket.connect(addr1).createNFT("2","2");
            const nftAddress = await nftMarket.getNFTAddress("2");
            const NFT = await ethers.getContractAt("NFT", nftAddress);
            const nft = await NFT.deployed();
            expect(await nft.creator()).to.equal(addr1.address);
        });

        it("Should have right creator", async function() {
            const {owner, nft1} = await loadFixture(contractDeploy);
            expect(await  nft1.creator()).to.equal(owner.address);
        });
    });

    describe("getNFTAddress", async function() {
        it("Should fail if nft isn't exist", async function() {
            const {nftMarket} = await loadFixture(contractDeploy);
            await expect(nftMarket.getNFTAddress("nftNotExist")).to.be.revertedWith("nft is not exist!");
        });

        it("Should get correct nft address", async function() {
            const {nftMarket, nft1} = await loadFixture(contractDeploy);
            expect(await nftMarket.getNFTAddress("hja")).to.equal(nft1.address);
        });
    });

    describe("placeOrder", async function() {
        it("Should place order", async function() {
            const {owner} = await loadFixture(contractDeploy);
            const {nft1, nftMarket} = await loadFixture(placeOrder);
            const order = await nftMarket.idToOrder(nft1.address,0);
            const {seller, nft, tokenId, price} = await nftMarket.getOrderInfo(0);
            expect(order.nft, order.tokenId).to.equal(nft1.address, 0);
            expect(seller, nft, tokenId, price).to.equal(owner.address, nft1.address, 0, 100);
        });

        it("Can't place the same order", async function() {
            const {nft1, nftMarket} = await loadFixture(placeOrder);
            await expect(nftMarket.placeOrder(nft1.address,0,1000)).to.be.revertedWith("token is already placed!");
        });

        it("Should have the right owner", async function() {
            const {nft1, nftMarket} = await loadFixture(placeOrder);
            expect(await nft1.ownerOf(0)).to.equal(nftMarket.address);
        });
    });

    describe("isListed", async function() {
        it("Should have correct status", async function() {
            const {nftMarket, nft1} = await loadFixture(placeOrder);
            expect(await nftMarket.isListed(nft1.address, 0)).to.be.true;
        });
    });

    describe("getOrderInfo", async function() {
        it("Should fail if order is empty", async function() {
            const {nftMarket} = await loadFixture(contractDeploy);
            await expect(nftMarket.getOrderInfo(0)).to.be.revertedWith("orders empty");
        });

        it("Should fail if index exceed orderList's lenght", async function() {
            const {nftMarket} = await loadFixture(placeOrder);
            await expect(nftMarket.getOrderInfo(100)).to.be.revertedWith("orderIndex is not exist");
        });

        it("Should return correct order information", async function() {
            const {owner} = await loadFixture(contractDeploy);
            const {nftMarket, nft1, price} = await loadFixture(placeOrder);
            const {seller, nft, tokenId} = await nftMarket.getOrderInfo(0);
            const Price = (await nftMarket.getOrderInfo(0)).price;
            expect(seller, nft, tokenId, Price).to.equal(owner.address, nft1.address, 0, price);
        });
    });

    describe("changePrice", async function() {
        it("Only owner can change price", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket, nft1} = await loadFixture(placeOrder);
            await expect(nftMarket.connect(addr1).changePrice(nft1.address,0,999)).to.be.revertedWith("you aren't owner of the token!");
        });

        it("Should change the exist order", async function() {
            const {nftMarket, nft1} = await loadFixture(placeOrder);
            await expect(nftMarket.changePrice(nft1.address,1,999)).to.be.revertedWith("the token is not place!");
        });

        it("Should have the right price after change Price", async function() {
            const {nftMarket, nft1} = await loadFixture(placeOrder);
            await nftMarket.changePrice(nft1.address,0,999);
            const order = await nftMarket.getOrderInfo(0);
            const idToOrder = await nftMarket.idToOrder(nft1.address,0);
            expect(order.price,idToOrder.price).to.equal(999,999);
        });
    });

    describe("cancelOrder", async function() {
        it("Should have the right owner", async function() {
            const {owner} = await loadFixture(contractDeploy);
            const {nft1, nftMarket} = await loadFixture(placeOrder);
            await nftMarket.cancelOrder(nft1.address,0);
            expect(await nft1.ownerOf(0)).to.equal(owner.address);
        });

        it("Should remove order", async function() {
            const {owner} = await loadFixture(contractDeploy);
            const {nft1, nftMarket} = await loadFixture(placeOrder);
            const index = await nftMarket.idToOrderIndex(nft1.address,0);
            await nftMarket.cancelOrder(nft1.address,0);
            expect(await nftMarket.idToOrderIndex(nft1.address,0)).to.equal(0);
            expect((await nftMarket.idToOrder(nft1.address,0)).seller).to.equal(ethers.constants.AddressZero);
            expect((await nftMarket.orders(index)).seller).not.to.equal(owner.address);
        });
    });

    describe("buyNft", async function() {
        it("Should have the right owner", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const{nft1} = await loadFixture(buyNft);
            expect(await nft1.ownerOf(0)).to.equal(addr1.address);
        });

        it("Can't buy nft less than price", async function() {
            const {usdt, addr1} = await loadFixture(contractDeploy);
            const {nft1, nftMarket} = await loadFixture(placeOrder);
            await usdt.mint(addr1.address,10**10);
            await usdt.connect(addr1).approve(nftMarket.address,1000);
            await expect(nftMarket.connect(addr1).buy(nft1.address, 0, 99)).to.be.revertedWith("your price is not enough!");
        });

        it("Should charge 0.3% commission", async function() {
            const {owner, addr1, usdt, nftMarket, nft1} = await loadFixture(contractDeploy);
            await nft1.mint(owner.address,0,"1");
            await nft1.approve(nftMarket.address,0);
            await nftMarket.placeOrder(nft1.address,0,1000);
            await usdt.mint(addr1.address,10**10);
            await usdt.connect(addr1).approve(nftMarket.address,10000);
            await expect(await nftMarket.connect(addr1).buy(nft1.address, 0, 1000))
              .to.changeTokenBalances(usdt, [owner.address, nftMarket.address], [997, 3]);
        });

        it("Should increase nft popularity", async function() {
            const {nftMarket, nft1} =await loadFixture(buyNft);
            expect(await nftMarket.nftToPopularity(nft1.address)).to.equal(1);
        })

        it("Should share 30% revenue with platform if signed", async function() {
            const {addr1, addr2, usdt, nft2} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            await nft2.mint(addr1.address,0,"1");
            await nft2.connect(addr1).approve(nftMarket.address,0);
            await nftMarket.connect(addr1).placeOrder(nft2.address,0,1000);
            await usdt.mint(addr2.address,10**10);
            await usdt.connect(addr2).approve(nftMarket.address,10000);
            await expect(nftMarket.connect(addr2).buy(nft2.address, 0, 1000))
              .to.changeTokenBalances(usdt, [addr1.address, nftMarket.address, addr2.address], [697, 303, -1000]);
        });

        it("Should remove order", async function() {
            const {owner} = await loadFixture(contractDeploy);
            const {nft1, nftMarket} = await loadFixture(placeOrder);
            const index = await nftMarket.idToOrderIndex(nft1.address,0);
            await loadFixture(buyNft);
            expect(await nftMarket.idToOrderIndex(nft1.address,0)).to.equal(0);
            expect((await nftMarket.idToOrder(nft1.address,0)).seller).to.equal(ethers.constants.AddressZero);
            expect((await nftMarket.orders(index)).seller).not.to.equal(owner.address);
        });
    });

    describe("applyForSigning", async function() {
        it("Should have the right status", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(applyForSigning);
            expect(await nftMarket.isApplyForSigning(addr1.address)).to.be.true;
        });

        it("Should haven't been applied", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket, signingExpiration} = await loadFixture(applyForSigning);
            await expect(nftMarket.connect(addr1).applyForSigning(1000,signingExpiration)).to.be.revertedWith("you have applied!");
        });

        it("Should haven't been signed", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60;
            const signingExpiration = await time.latest() + 2 * ONE_MONTH_IN_SECS;
            await expect(nftMarket.connect(addr1).applyForSigning(1000,signingExpiration)).to.be.revertedWith("you have been signed!");
        });

        it("Should have the right applyForSigningList", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket, signingAmount, signingExpiration} = await loadFixture(applyForSigning);
            const addrToSigningApplyIndex = await nftMarket.addrToSigningApplyIndex(addr1.address);
            const signingInfo = await nftMarket.applyForSigningList(addrToSigningApplyIndex);
            expect(addrToSigningApplyIndex).to.equal(0);
            expect(signingInfo.creator, signingInfo.signingAmount, signingInfo.signingExpiration)
              .to.equal(addr1.address, signingAmount, signingExpiration);            
        });
    });

    describe("platformManageSigning", async function() {
        it("Should fail if user isn't apply", async function() {
            const {nftMarket, owner} = await loadFixture(contractDeploy);
            await expect(nftMarket.platformManageSigning(owner.address,true)).to.be.revertedWith("user not apply");
        });

        it("Should fail if caller isn't owner", async function() {
            const {addr2,addr1} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(applyForSigning);
            await expect(nftMarket.connect(addr2).platformManageSigning(addr1.address,true))
              .to.be.revertedWith("you are not owner!");
        });

        it("Should transfer if paltform agree to sign", async function() {
            const {addr1,usdt} = await loadFixture(contractDeploy);
            const {nftMarket, signingAmount} = await loadFixture(applyForSigning);
            await usdt.approve(nftMarket.address,10**10);
            await expect(nftMarket.platformManageSigning(addr1.address,true))
              .to.changeTokenBalance(usdt, addr1.address, signingAmount);
        });

        it("Should have the right status if paltform agree to sign", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {signingAmount, signingExpiration} = await loadFixture(applyForSigning);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            const index = await nftMarket.addrToSignedListIndex(addr1.address);
            const signingInfo = await nftMarket.signedList(index);
            const addrToSigningInfo = await nftMarket.addrToSigningInfo(addr1.address);
            expect(await nftMarket.isSigned(addr1.address)).to.be.true;
            expect(await nftMarket.addrToSignedListIndex(addr1.address)).to.equal(0);
            expect(signingInfo.creator, signingInfo.signingAmount, signingInfo.signingExpiration)
              .to.equal(addr1.address, signingAmount, signingExpiration);
            expect(addrToSigningInfo.creator, addrToSigningInfo.signingAmount, addrToSigningInfo.signingExpiration)
              .to.equal(addr1.address, signingAmount, signingExpiration);
        });
    });

    describe("platformInviteSigning", async function() {
        const signingAmount = 1000;
        const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60;
        it("Should fail if caller isn't owner", async function() {
            const {nftMarket, addr1} = await loadFixture(contractDeploy);
            const signingExpiration = await time.latest() + 2 * ONE_MONTH_IN_SECS;
            await expect(nftMarket.connect(addr1).platformInviteSigning(addr1.address, signingAmount, signingExpiration))
              .to.be.revertedWith("you aren't owner!");
        });

        it("Should fail if signingExpiration less than 30 days", async function() {
            const {nftMarket, addr1} = await loadFixture(contractDeploy);
            const signingExpiration = await time.latest() + 0.5 * ONE_MONTH_IN_SECS;
            await expect(nftMarket.platformInviteSigning(addr1.address, signingAmount, signingExpiration))
              .to.be.revertedWith("at least signing for 30 day!");
        });

        it("Should fail if creator has been signed", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(userAgreeSigningInvite);
            const signingExpiration = await time.latest() + 2 * ONE_MONTH_IN_SECS;
            await expect(nftMarket.platformInviteSigning(addr1.address, signingAmount, signingExpiration))
              .to.be.revertedWith("creator has signed!");
        });

        it("Should fail if creator had been invited", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket, signingAmount} = await loadFixture(platformInviteSigning);
            const signingExpiration = await time.latest() + 2 * ONE_MONTH_IN_SECS;
            await expect(nftMarket.platformInviteSigning(addr1.address, signingAmount, signingExpiration))
              .to.be.revertedWith("creator had been invited!");
        });

        it("Should have right invite information", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(platformInviteSigning);
            const addr1SigningAmount = 1000;
            const addr1SigningExpiration = await time.latest() + 2 * ONE_MONTH_IN_SECS;
            const {signingAmount, signingExpiration} = await nftMarket.connect(addr1).checkForInviteInfo();
            expect(signingAmount, signingExpiration).to.equal(addr1SigningAmount, addr1SigningExpiration);
        });

        it("Should transfer owner's balance", async function() {
            const {nftMarket, addr1, owner, usdt} = await loadFixture(contractDeploy);
            const signingExpiration = await time.latest() + 2 * ONE_MONTH_IN_SECS;
            await usdt.approve(nftMarket.address,10**10);
            await expect(nftMarket.platformInviteSigning(addr1.address, signingAmount, signingExpiration))
              .to.changeTokenBalances(usdt, [owner.address, nftMarket.address], [-signingAmount, signingAmount]);
        });
    });

    describe("userManageSigningInvite", async function() {
        it("Should fail if caller haven't been invited", async function() {
            const {nftMarket} = await loadFixture(contractDeploy);
            await expect(nftMarket.userManageSigningInvite(true)).to.be.revertedWith("you haven't been invited!");
        });

        it("Should have right status if agree signing", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {signingAmount, signingExpiration} = await loadFixture(platformInviteSigning);
            const {nftMarket} = await loadFixture(userAgreeSigningInvite);
            const index = await nftMarket.addrToSignedListIndex(addr1.address);
            const signingInfo = await nftMarket.signedList(index);
            expect(await nftMarket.isSigned(addr1.address)).to.be.true;
            expect(signingInfo.creator, signingInfo.signingAmount, signingInfo.signingExpiration)
              .to.equal(addr1.address, signingAmount, signingExpiration);
        });

        it("Should change balance if agree signing", async function() {
            const {addr1,usdt} = await loadFixture(contractDeploy);
            const {nftMarket, signingAmount} = await loadFixture(platformInviteSigning);
            await expect(nftMarket.connect(addr1).userManageSigningInvite(true))
              .to.changeTokenBalances(usdt, [addr1.address, nftMarket.address], [signingAmount, -signingAmount]);
        });

        it("Should return token to owner if disagree signing", async function() {
            const {owner, addr1,usdt} = await loadFixture(contractDeploy);
            const {nftMarket, signingAmount} = await loadFixture(platformInviteSigning);
            await expect(nftMarket.connect(addr1).userManageSigningInvite(false))
              .to.changeTokenBalances(usdt, [owner.address, nftMarket.address], [signingAmount, -signingAmount]);
        });

        it("Should delete invite information", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(userAgreeSigningInvite);
            await expect(nftMarket.checkForInviteInfo(addr1.address)).to.be.reverted;
        });
    });

    describe("platformPopularize", async function() {
        it("Should fail if caller is not owner", async function() {
            const {addr1, nftMarket, nft1} = await loadFixture(contractDeploy);
            await expect(nftMarket.connect(addr1).platformPopularize(nft1.address, 10))
              .to.be.revertedWith("you are not owner!");
        });

        it("Should fail if signing has expired", async function() {
            const {nft2} = await loadFixture(contractDeploy);
            const {signingExpiration} = await loadFixture(applyForSigning);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            await time.increaseTo(signingExpiration);
            await expect(nftMarket.platformPopularize(nft2.address, 10))
              .to.be.revertedWith("signing has expired!");
        });

        it("Should increase popularity, popularizeNum and popularizeAmount", async function() {
            const {nft2} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            const beforePopularity = await nftMarket.nftToPopularity(nft2.address);
            const beforePopularizeNum = (await nftMarket.nftToPopularizeInfo(nft2.address)).popularizeNum;
            const beforePopularizeAmount = (await nftMarket.nftToPopularizeInfo(nft2.address)).popularizeAmount;
            await nftMarket.platformPopularize(nft2.address, 10);
            const afterPopularity = await nftMarket.nftToPopularity(nft2.address);
            const afterPopularizeNum = (await nftMarket.nftToPopularizeInfo(nft2.address)).popularizeNum;
            const afterPopularizeAmount = (await nftMarket.nftToPopularizeInfo(nft2.address)).popularizeAmount;
            expect(afterPopularity).to.equal(beforePopularity.add(10));
            expect(afterPopularizeNum).to.equal(beforePopularizeNum.add(1));
            expect(afterPopularizeAmount).to.equal(beforePopularizeAmount.add(10));
        });
    });

    describe("buyNFTPopularity", async function() {
        it("Should transfer token", async function() {
            const {owner, nftMarket, nft1, usdt} = await loadFixture(contractDeploy);
            await usdt.approve(nftMarket.address,10**10); 
            await expect(nftMarket.buyNFTPopularity(nft1.address, 10))
              .to.changeTokenBalances(usdt, [owner.address, nftMarket.address], [-10, 10]);
        });

        it("Should have right nft popularity", async function() {
            const {nftMarket, nft1, usdt} = await loadFixture(contractDeploy);
            await usdt.approve(nftMarket.address,10**10); 
            const beforePopularity = await nftMarket.nftToPopularity(nft1.address);
            await nftMarket.buyNFTPopularity(nft1.address, 10);
            const afterPopularity = await nftMarket.nftToPopularity(nft1.address);
            const changePopularity = (await nftMarket.popularityPrice()) * 10;
            expect(afterPopularity).to.equal(beforePopularity.add(changePopularity));
        });
    });

    describe("userCancelSigning", async function() {
        it("Should fail if user haven't been signed", async function() {
            const {nftMarket} = await loadFixture(contractDeploy);
            await expect(nftMarket.userCancelSigning()).to.be.revertedWith("you haven't been signed!");
        });

        it("Should pay penalty before signingExpiration", async function() {
            const {addr1, usdt} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            const penalty = await nftMarket.penalty();
            await usdt.mint(addr1.address,penalty);
            await usdt.connect(addr1).approve(nftMarket.address, penalty);
            await expect(nftMarket.connect(addr1).userCancelSigning())
              .to.changeTokenBalances(usdt, [addr1.address, nftMarket.address], [-penalty, penalty]);
        });

        it("Should remove signed status", async function() {
            const {addr1, usdt} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            const penalty = await nftMarket.penalty();
            await usdt.mint(addr1.address,penalty);
            await usdt.connect(addr1).approve(nftMarket.address, penalty);
            const index = await nftMarket.addrToSignedListIndex(addr1.address);
            await nftMarket.connect(addr1).userCancelSigning();
            expect((await nftMarket.signedList(index)).creator).not.to.equal(addr1.address);
            expect(await nftMarket.isSigned(addr1.address)).to.be.false;
            expect(await nftMarket.addrToSignedListIndex(addr1.address)).to.equal(0);
            expect((await nftMarket.addrToSigningInfo(addr1.address)).creator).not.to.equal(addr1.address);
        });
    });

    describe("platformCancelSigning", async function() {
        it("Should fail if caller isn't owner", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            await expect(nftMarket.connect(addr1).platformCancelSigning(addr1.address))
              .to.be.revertedWith("you aren't owner!");
        });

        it("Should fail if user didn't signed", async function() {
            const {nftMarket, addr1} = await loadFixture(contractDeploy);
            await expect(nftMarket.platformCancelSigning(addr1.address))
              .to.be.revertedWith("user didn't signing");
        });

        it("Should remove signed status", async function() {
            const {addr1} = await loadFixture(contractDeploy);
            const {nftMarket} = await loadFixture(platformAgreeSigning);
            const index = await nftMarket.addrToSignedListIndex(addr1.address);
            await nftMarket.platformCancelSigning(addr1.address);
            expect((await nftMarket.signedList(index)).creator).not.to.equal(addr1.address);
            expect(await nftMarket.isSigned(addr1.address)).to.be.false;
            expect(await nftMarket.addrToSignedListIndex(addr1.address)).to.equal(0);
            expect((await nftMarket.addrToSigningInfo(addr1.address)).creator).not.to.equal(addr1.address);
        });
    });

    describe("changePenalty", async function() {
        it("Should fail if caller isn't owner", async function() {
            const {nftMarket, addr1} = await loadFixture(contractDeploy);
            await expect(nftMarket.connect(addr1).changePenalty(100)).to.be.revertedWith("you aren't owner!");
        });

        it("Should have the right penalty", async function() {
            const {nftMarket} = await loadFixture(contractDeploy);
            await nftMarket.changePenalty(100);
            expect(await nftMarket.penalty()).to.be.equal(100);
        });
    });

    describe("changePopularityPrice", async function() {
        it("Should fail if caller isn't owner", async function() {
            const {nftMarket, addr1} = await loadFixture(contractDeploy);
            await expect(nftMarket.connect(addr1).changePopularityPrice(100)).to.be.revertedWith("you are not owner!");
        });

        it("Should have the right popularityPrice", async function() {
            const {nftMarket} = await loadFixture(contractDeploy);
            await nftMarket.changePopularityPrice(100);
            expect(await nftMarket.popularityPrice()).to.equal(100);
        });
    });

    describe("updateNFTLeaderBoard", async function() {
        it("Should have right nftLeaderBoard", async function() {
            const {nftMarket, nft1, nft2, nft3} = await loadFixture(updateNFTLeaderBoard);
            expect((await nftMarket.nftLeaderBoard(0)).nft).to.equal(nft2.address);
            expect((await nftMarket.nftLeaderBoard(1)).nft).to.equal(nft3.address);
            expect((await nftMarket.nftLeaderBoard(2)).nft).to.equal(nft1.address);
        });
    });

    describe("getNFTLeaderBoard", async function() {
        it("Should fail if index exceed leaderBoard's lenght", async function() {
            const {nftMarket} = await loadFixture(updateNFTLeaderBoard);
            await expect(nftMarket.getNFTLeaderBoard(100)).to.be.revertedWith("nftNum error!");
        });

        it("Should return right information", async function() {
            const {nftMarket, nft2, nft3} = await loadFixture(updateNFTLeaderBoard);
            expect((await nftMarket.getNFTLeaderBoard(0)).nft).to.equal(nft2.address);
            expect((await nftMarket.getNFTLeaderBoard(0)).popularity).to.equal(30);
            expect((await nftMarket.getNFTLeaderBoard(1)).nft).to.equal(nft3.address);
            expect((await nftMarket.getNFTLeaderBoard(1)).popularity).to.equal(20);
        });
    });

    describe("withdraw", async function() {
        it("Should fail if caller isn't owner", async function() {
            const {nftMarket, addr1} = await loadFixture(contractDeploy);
            await expect(nftMarket.connect(addr1).withdraw()).to.be.revertedWith("you are not owner!");
        });

        it("Should transfer usdt from nftMarket to owner", async function() {
            const {owner, addr1, nftMarket, nft1, usdt} = await loadFixture(contractDeploy);
            await usdt.connect(addr1).approve(nftMarket.address,10**10);
            await usdt.mint(addr1.address,10**10); 
            await nftMarket.connect(addr1).buyNFTPopularity(nft1.address, 10);
            const nftMarketUSDTBalance = await usdt.balanceOf(nftMarket.address);
            await expect(nftMarket.withdraw()).to.changeTokenBalances(
              usdt,
              [owner.address, nftMarket.address],
              [nftMarketUSDTBalance, -nftMarketUSDTBalance]
            );
        });
    });
});