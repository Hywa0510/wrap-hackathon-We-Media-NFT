import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

import UploadImage from './components/UploadImage.js';
import Navbar from './components/Navbar.js';
import UploadSuccess from './components/UploadSuccess.js';
import NFTGrid from './components/NFTGrid.js';
import NFTDetail from './components/NFTDetail.js';

function App() {
  const [walletAddress, setWallet] = useState("");

  useEffect(() => {
    addWalletListener();
  }, []);

  function addWalletListener() {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setWallet(accounts[0]);
        } else {
          setWallet("");
        }
      });
    }   
  }

  const getWalletAddress = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWallet(accounts[0]); // Set the first account as the connected account
      } catch (error) {
        console.error('Error connecting to wallet:', error);
      }
    }
  };

  return (
    <div id="container" style={{color:'green'}}>
      <Router>
        <Navbar onConnectWallet={getWalletAddress} address={walletAddress} />

        <Routes>
          <Route path="/create-nft" exact element={<UploadImage address={walletAddress}/>} />
          <Route path="/success" element={<UploadSuccess />} />
          <Route path="/" element={<NFTGrid />} />
          <Route path="/nft-detail/:tokenId" element={<NFTDetail />} />
        </Routes>
      </Router>

      <h className='foo'>尊敬的用户，你好。
      <h6>我们非常高兴地向你介绍我们基于区块链的自媒体运营平台。这个平台充分融合了区块链的透明、安全、可追溯的特点，旨在让每一位自媒体作者都能享受公平、公正的运营环境。</h6>
      <h6>1,快速发布你的原创内容，并为每一篇内容生成唯一的哈希值，实行版权保护。
2. 阅读和分享来自全球各地的优质内容，并为你喜欢的作者和内容点赞打赏，所有的交易数据都将被记录在区块链上，无法篡改，公开透明。
3. 参与到我们的社区管理中来，进行内容的投票篡改，决定平台的运营规则，体验真正的由用户驱动的自媒体运营平台。
4. 通过我们的智能合约，将你的粉丝转化为你的股东，让他们能够分享你的成功。

我们的区块链自媒体运营平台致力于创造具有价值、公平、透明的内容生态。在这里，每一位用户都可以找到属于自己的创作舞台，每一个声音都可以得到公正的回应。加入我们，一起去探索未知的可能，开创自媒体新时代吧！</h6>
</h>
<h className='foo1'>期待你的加入！

区块链自媒体运营平台团队 敬上</h>
    </div> 
  );
};

export default App;
