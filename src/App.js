import React, { useEffect, useState } from 'react';
import './styles/App.css';
import twitterLogo from './assets/twitter-logo.svg';
import { ethers } from 'ethers';
import contractABI from './utils/contractABI.json';

import polygonLogo from './assets/polygonlogo.png';
import ethLogo from './assets/ethlogo.png';
import pencil from './assets/pencil.png';
import { networks } from './utils/networks';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Constants
const TWITTER_HANDLE = '_buildspace';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;

const tld = '.irl';
// const CONTRACT_ADDRESS = '0x3D730b3cD5df1A532824ee7d250C0F5810C08A05';
const CONTRACT_ADDRESS = '0x984BF0C43F3D446c80F91B681c6c14e9755fDf8A';
// const CONTRACT_ADDRESS = '0xCA0969D8562b85202F6D9EBD4f62D1187aC94f84';

const OpenSeaLink = (props) => {
	return (
		<a className="link" href={`https://testnets.opensea.io/assets/mumbai/${props.contract}/${props.mintId}`} target="_blank" rel="noopener noreferrer">
			<p className="underlined">{' '}{props.linkName}{' '}</p>
		</a>
	);
}

const Msg = (props) => (
	<div>
		<p>{props.message}</p>
		{ props.toastLink ? props.toastLink : '' }
	</div>
);

const App = () => {

	const [network, setNetwork] = useState('');
	const [currentAccount, setCurrentAccount] = useState('');
	const [domain, setDomain] = useState('');
	const [record, setRecord] = useState('');
	const [loading, setLoading] = useState(false);
	const [editing, setEditing] = useState(false);
	const [mints, setMints] = useState([]);

	// Connection
	const connectWallet = async () => {
		try {
			const { ethereum } = window;

			if (!ethereum) {
				alert("Get MetaMask -> https://metamask.io/");
				return;
			}

			const accounts = await ethereum.request({ method: "eth_requestAccounts" });
		
			console.log("Connected", accounts[0]);
			setCurrentAccount(accounts[0]);
		} catch (error) {
			console.log(error)
		}
	}

	const checkIfWalletIsConnected = async () => {
		const { ethereum } = window;
		if (!ethereum) {
			console.log("Make sure you have MetaMask!");
			return;
		} else {
			console.log("We have the ethereum object", ethereum);
		}
		const accounts = await ethereum.request({ method: 'eth_accounts' });
		if (accounts.length !== 0) {
			const account = accounts[0];
			console.log('Found an authorized account:', account);
			setCurrentAccount(account);
		} else {
			console.log('No authorized account found');
		}
		const chainId = await ethereum.request({ method: 'eth_chainId' });
		setNetwork(networks[chainId]);
		// Reload page on network change
		ethereum.on('chainChanged', handleChainChanged);
		function handleChainChanged(_chainId) {
			window.location.reload();
		}
	}

	const switchNetwork = async () => {
		if (window.ethereum) {
			try {
				await window.ethereum.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: '0x13881' }], // Check networks.js for hexadecimal network ids
				});
			} catch (error) {
				// If user doesn't have Mumbai on Metamask, we ask to add it.
				if (error.code === 4902) {
					try {
						await window.ethereum.request({
							method: 'wallet_addEthereumChain',
							params: [
								{	
									chainId: '0x13881',
									chainName: 'Polygon Mumbai Testnet',
									rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
									nativeCurrency: {
											name: "Mumbai Matic",
											symbol: "MATIC",
											decimals: 18
									},
									blockExplorerUrls: ["https://mumbai.polygonscan.com/"]
								},
							],
						});
					} catch (error) {
						console.log(error);
					}
				}
				console.log(error);
			}
		} else {
			// If window.ethereum is not found then MetaMask is not installed
			alert('MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html');
		} 
	}

	// Hooks for app changes
	useEffect(() => {
		checkIfWalletIsConnected();
	}, [])

	useEffect(() => {
		if (network === 'Polygon Mumbai Testnet') {
			fetchMints();
		}
	}, [currentAccount, network]);

	// Contract Interactions
	const mintDomain = async () => {

		if (!domain) { return }

		if (domain.length < 3) {
			alert('Domain must be at least 3 characters long');
			return;
		}


		const price = domain.length === 3 ? '0.5' : domain.length === 4 ? '0.1' : '0.05';
		console.log("Minting domain", domain, "with price", price);
		try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);
			
				console.log("Going to pop wallet now to pay gas...")

				let tx = await contract.register(domain, {value: ethers.utils.parseEther(price)});
				const receipt = await tx.wait();
			
				
				if (receipt.status === 1) {

					const event = receipt.events.find(event => event.event === 'Transfer');
					const [from, to, tokenId] = event.args;
					console.log(from, to, tokenId);
					const mintId = tokenId.toNumber();

					console.log("Domain minted! https://mumbai.polygonscan.com/tx/"+tx.hash);
					
					
					tx = await contract.setRecord(domain, record);
					const receipt2 = await tx.wait();
					
					if (receipt2.status === 1) {
						console.log("Record set! https://mumbai.polygonscan.com/tx/"+tx.hash);
					}
					
					setTimeout(() => {
						notify("🍄 Domain minted! ", <OpenSeaLink contract={CONTRACT_ADDRESS} mintId={mintId} linkName={domain+tld} />)
						fetchMints();
					}, 2000); // Call fetchMints after 2 seconds
					

					setRecord('');
					setDomain('');
				}
				else {
					alert("Transaction failed! Please try again");
				}
			}
		}
		catch(error){
			console.log(error);
		}
	}

	const updateDomain = async () => {
		if (!record || !domain) { return }
		setLoading(true);
		console.log("Updating domain", domain, "with record", record);
		  try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);
	
				let tx = await contract.setRecord(domain, record);
				await tx.wait();
				console.log("Record set https://mumbai.polygonscan.com/tx/"+tx.hash);
	
				fetchMints();
				setRecord('');
				setDomain('');
			}
		  } catch(error) {
			console.log(error);
		  }
		setLoading(false);
	}

	const fetchMints = async () => {
		try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);

				const names = await contract.getAllNames();

				const mintRecords = await Promise.all(names.map(async (name) => {
					const mintRecord = await contract.records(name);
					const owner = await contract.domains(name);
					return {
						id: names.indexOf(name),
						name: name,
						record: mintRecord,
						owner: owner,
					};
				}));
	
			console.log("MINTS FETCHED ", mintRecords);
			setMints(mintRecords);
			}
		} catch(error){
			console.log(error);
		}
	}

	// Render

	const notify = (message, link) => toast(<Msg message={message} toastLink={link} />);

	const renderNotConnectedContainer = () => (
		<div className="connect-wallet-container">
			<img src="/fry-meme-real-life.jpeg" alt="IRL meme" />
			<button onClick={connectWallet} className="cta-button connect-wallet-button" >
				Connect Wallet
			</button>
		</div>
  	);

	  const renderInputForm = () =>{
		if (network !== 'Polygon Mumbai Testnet') {
			return (
				<div className="connect-wallet-container">
					<p>Please connect to the Polygon Mumbai Testnet</p>
					<button className='cta-button mint-button' onClick={switchNetwork}>Click here to switch</button>
				</div>
			);
		}
		return (
			<div className="form-container">
				<div className="first-row">
					<input
						type="text"
						value={domain}
						placeholder='domain'
						onChange={e => setDomain(e.target.value)}
					/>
					<p className='tld'> {tld} </p>
				</div>

				<input
					type="text"
					value={record}
					placeholder='who u be in real life?'
					onChange={e => setRecord(e.target.value)}
				/>

				<div className="button-container">
					{editing ? (
						<div className="button-container">
							<button className='cta-button mint-button' disabled={loading} onClick={updateDomain}>
								Set record
							</button>  
							<button className='cta-button mint-button' onClick={() => {setEditing(false); setDomain('');}}>
								Cancel
							</button>  
						</div>
					) : (
						<button className='cta-button mint-button' disabled={loading} onClick={mintDomain}>
							Mint
						</button>  
					)}
				</div>

			</div>
		);
	}

	const renderMints = () => {
		if (currentAccount && mints.length > 0) {
			return (
				<div className="mint-container">
					<p className="subtitle"> Recently minted domains!</p>
					<div className="mint-list">
						{ mints.map((mint, index) => {
							return (
								<div className="mint-item" key={index}>
									<div className='mint-row'>
										<a className="link" href={`https://testnets.opensea.io/assets/mumbai/${CONTRACT_ADDRESS}/${mint.id}`} target="_blank" rel="noopener noreferrer">
											<p className="underlined">{' '}{mint.name}{tld}{' '}</p>
										</a>
										{/* If mint.owner is currentAccount, add an "edit" button*/}
										{ mint.owner.toLowerCase() === currentAccount.toLowerCase() ?
											<button className="edit-button" onClick={() => editRecord(mint.name)}>
												{/* <img className="edit-icon" src="https://img.icons8.com/metro/26/000000/pencil.png" alt="Edit button" /> */}
												<img className="edit-icon" src={pencil} alt="Edit button" />
											</button>
											:
											null
										}
									</div>
						<p> {mint.record} </p>
					</div>)
					})}
				</div>
			</div>);
		}
	};

	// Helper functions
	const editRecord = (name) => {
		console.log("Editing record for", name);
		setEditing(true);
		setDomain(name);
	}

  	return (
		<div className="App">
			<div className="container">

				<ToastContainer autoClose={8000} position={toast.POSITION.TOP_CENTER} />

				<div className="header-container">
					<header>
						<div className="left">
							<p className="title">🍄&nbsp;
								<span className="gradient1">I</span> 
            					<span className="gradient2">R</span> 
            					<span className="gradient3">L</span>
								&nbsp;Name Service
							</p>
							<p className="subtitle">Your IRL API on the blockchain!</p>
						</div>
						<div className="right wallet-info-container">
							<img alt="Network logo" className="logo" src={ network.includes("Polygon") ? polygonLogo : ethLogo } />
							{ currentAccount ? <p> Wallet: {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)} </p> : <p> Not connected </p> }
						</div>
					</header>
				</div>

				{!currentAccount && renderNotConnectedContainer()}
				{currentAccount && renderInputForm()}
				{mints && renderMints()}

        		<div className="footer-container">
					<img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
					<a
						className="footer-text"
						href={TWITTER_LINK}
						target="_blank"
						rel="noreferrer"
					>{`built with @${TWITTER_HANDLE}`}</a>
				</div>
			</div>
		</div>
	);
}

export default App;
