
# NFT Updater CLI

## Description

NFT Updater CLI allows you to update NFT metadata on the Solana blockchain. It provides a user-friendly interface for updating various attributes of an NFT such as name, symbol, description, attributes, royalty, and more, using the Shyft API.

## Features

- Update single or multiple NFTs' metadata.
- Interactive CLI for ease of use.
- Robust error handling and user input validation.

## Requirements

- Node.js v18+
- npm or yarn
- Shyft API key
- Private key of the NFT/s Update Authority in base64 format (can be converted from Solana Phantom wallet private key in the script)
- RPC node URL from Shyft [Shyft](https://shyft.to/get-api-key)

## Installation

```bash
git clone https://github.com/builderby/nft-updater-cli.git
cd nft-updater-cli
npm install
```
- Rename the `.env.example` to `.env` in the root directory

## Usage

- Ensure you have a Shyft API key, RPC node URL and set up in the .env file. You can get a free API key from [Shyft](https://shyft.to/get-api-key). This is required to interact with the Shyft API. You will also need a private key in base64 format. You can use your Solana Phantom wallet private key and convert it with the script or even use a solana keypair in the script and it will also convert it to base64 for you. if you dont want to do that just get a base64 format of your private key and paste it in the .env file. When it asks to add your private key in base64 format just press N for No and it will use the one in the .env file. You will have to do the same for the Fee Payer private key if you decide to not use the update authority and use a fee payer instead.



1. **Single NFT Update**: Update metadata for a single NFT.
2. **Multiple NFTs Update**: Update metadata for multiple NFTs by providing a JSON file.

### Environment Variables

Rename `.env.example` file in the root directory and add add your Shyft API key, RPC node URL, and private key in base64 format. Alternatively you can use your Solana Phantom wallet private key and convert it with the script.

```env
API_KEY=YOUR_SHYFT_API_KEY
RPC_NODE=RPC_NODE_URL
PRIVATE_KEY_BASE64=YOUR_PRIVATE_KEY_IN_BASE64_FORMAT
```

### Update a Single NFT

Run the CLI and select "Single" when prompted:

```bash
npm start
```

### Update Multiple NFTs

Provide a JSON file path when prompted after selecting "Multiple". We have included an example JSON file in the root directory named multiNFTExample.json, it contains two NFTs to update as an example.


## API Documentation

Refer to the Shyft API documentation for [updating NFT metadata](https://api.shyft.to/docs).

You can update the following NFT attributes:

- name
- symbol
- description
- royalty
- attributes
- media
- image
- update authority
- fee payer for update fee

## Contributing

We welcome contributions from the community! Please read the [contributing guide](CONTRIBUTING.md) to get started.

## License

This project is open source under the MIT License. See [LICENSE](LICENSE) for more details.
