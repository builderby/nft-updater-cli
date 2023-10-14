import axios from "axios";
import FormData from "form-data";
import { Keypair, Transaction, Connection } from "@solana/web3.js";
import ora from "ora";
import dotenv from "dotenv";
import inquirer from "inquirer";
import fs from 'fs';
import bs58 from 'bs58';
import sharp from 'sharp';
import path from 'path';

// Load environment variables from a .env file
dotenv.config();
dotenv.config({ path: './.env' }); // Load .env from the current directory

// Read API key and RPC node URL from environment variables
const API_KEY = process.env.API_KEY;
const RPC_NODE = process.env.RPC_NODE;
const PRIVATE_KEY_BASE64 = process.env.PRIVATE_KEY_BASE64;

async function compressImage(inputPath, outputPath, quality) {
  try {
    await sharp(inputPath)
      .jpeg({ quality }) // Adjust JPEG quality as needed
      .toFile(outputPath);
    console.log('Image compressed successfully.');
  } catch (error) {
    console.error('Error compressing image:', error);
  }
}

// Function to update the PRIVATE_KEY_BASE64 in .env file
function updatePrivateKeyInEnv(privateKey) {
  const envPath = './.env';
  let envData = fs.readFileSync(envPath, 'utf8');
  // Create or update the PRIVATE_KEY_BASE64 variable in the .env file
  const newEnvData = envData.replace(
    /^PRIVATE_KEY_BASE64=.*$/m,
    `PRIVATE_KEY_BASE64=${privateKey}`
  );
  fs.writeFileSync(envPath, newEnvData);
}

async function promptForKeys() {
  console.clear();

  // Prompt the user for the private key
  const keyResponse = await inquirer.prompt([
    {
      type: "input",
      name: "privateKey",
      message: "Enter your private key (in Solana Phantom format or keypair format):",
    },
  ]);

  // Check if the key is in the Solana Phantom wallet format
  let privateKey = keyResponse.privateKey;
  if (privateKey.length === 88 && privateKey.startsWith("2") && /^[a-km-zA-HJ-NP-Z1-9]+$/.test(privateKey)) {
    // Convert the Solana wallet private key to BASE64
    try {
      const decodedKey = bs58.decode(privateKey);
      privateKey = Buffer.from(decodedKey).toString('base64');
    } catch (error) {
      console.error("Error converting private key:", error);
      process.exit(1);
    }
  } else if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
    // Parse the string into an array
    const privateKeyArray = JSON.parse(privateKey);
    if (Array.isArray(privateKeyArray) && privateKeyArray.length === 64) {
      // Convert the array private key to BASE64
      privateKey = Buffer.from(privateKeyArray).toString('base64');
    }
  }

  // Update the PRIVATE_KEY_BASE64 variable in the .env file
  updatePrivateKeyInEnv(privateKey);

  // Prompt the user for the fee payer address and private key
  const feePayerResponse = await inquirer.prompt([
    {
      type: "confirm",
      name: "useCustomFeePayer",
      message: "Do you want to use a different fee payer address and private key for the fee?",
      default: false,
    },
  ]);

  let feePayerAddress, feePayerPrivateKey;
  if (feePayerResponse.useCustomFeePayer) {
    const feePayerAddressResponse = await inquirer.prompt([
      {
        type: "input",
        name: "feePayerAddress",
        message: "Enter the fee payer address:",
      },
    ]);
    const feePayerPrivateKeyResponse = await inquirer.prompt([
      {
        type: "password",
        name: "feePayerPrivateKey",
        message: "Enter the fee payer private key:",
      },
    ]);
    feePayerAddress = feePayerAddressResponse.feePayerAddress;
    feePayerPrivateKey = feePayerPrivateKeyResponse.feePayerPrivateKey;
  }

  return { privateKey, feePayerAddress, feePayerPrivateKey };
}

// Update the NFT using the provided private key and fee payer information
async function updateNFT(apiKey, parameters, privateKey, feePayerAddress, feePayerPrivateKey) {
  const data = new FormData();
  const logData = {};

  // Get the current working directory
  const currentWorkingDirectory = process.cwd();

    // Iterate through provided parameters
    for (const key of Object.keys(parameters)) {
      const value = parameters[key];
      if (value !== undefined && value !== "") {
        if (key === "imageFilePath") {
          // Specify the output path for the compressed image
          const extension = path.extname(value);
          const fileName = path.basename(value, extension);
          const outputPath = path.join(currentWorkingDirectory, `${fileName}_compressed.jpg`); // Adjust the format if needed
  
          // Compress the image and save it to the specified output path
          await compressImage(value, outputPath, 90); // Adjust quality as needed
  
          // Add the compressed image to the form data
          data.append('image', fs.createReadStream(outputPath));
          logData[key] = `Compressed image (${outputPath})`;
        } else if (key === "attributes" || key === "service_charge") {
          // Check if the value is already a JSON string
          if (typeof value === 'string') {
            // Attempt to parse the JSON string into an object
            try {
              const parsedValue = JSON.parse(value);
              data.append(key, JSON.stringify(parsedValue));
              logData[key] = JSON.stringify(parsedValue);
            } catch (error) {
              // If parsing fails, treat it as a regular string
              data.append(key, value);
              logData[key] = value;
            }
          } else {
            // If it's not a string, just append it as is
            data.append(key, value);
            logData[key] = value;
          }
        } else {
          // For other fields, simply append the value
          data.append(key, value);
          logData[key] = value;
        }
      }
    }

   // Initialize a spinner for progress feedback
   const spinner = ora("Sending update request to NFT API...").start();

   try {
     // Send a POST request to the NFT API with the provided data
     const response = await axios.request({
       method: "post",
       url: "https://api.shyft.to/sol/v2/nft/update",
       headers: {
         "x-api-key": apiKey,
         ...data.getHeaders(),
       },
       data: data,
     });
 
     // Display success message and proceed to signing the transaction
     spinner.succeed("Update request successful! Signing transaction...");
 
     const encodedTransaction = response.data.result.encoded_transaction;
     const feePayerPrivateKeyBase64 = feePayerPrivateKey
       ? Buffer.from(feePayerPrivateKey, 'base64').toString('base64')
       : null;
     const txnSignature = await signAndSendTransaction(
       encodedTransaction,
       privateKey,
       feePayerAddress,
       feePayerPrivateKeyBase64
     );
     console.log("Transaction Signature:", txnSignature);
   } catch (error) {
     // Handle errors and display relevant information
     spinner.fail(`Update request failed: ${error.message}`);
     if (error.response) {
       console.error(error.response.data);
       console.error(error.response.status);
       console.error(error.response.headers);
     } else if (error.request) {
       console.error(error.request);
     } else {
       console.error("Error", error.message);
     }
   }
 }

// Function to sign and send a transaction
async function signAndSendTransaction(encodedTransaction, fromPrivateKeyBase64, feePayerAddress, feePayerPrivateKeyBase64) {
  try {
    const connection = new Connection(RPC_NODE, "confirmed");
    const feePayer = feePayerAddress
      ? Keypair.fromSecretKey(Buffer.from(feePayerPrivateKeyBase64, 'base64'))
      : Keypair.fromSecretKey(Buffer.from(fromPrivateKeyBase64, 'base64'));
    const recoveredTransaction = Transaction.from(
      Buffer.from(encodedTransaction, "base64")
    );
    recoveredTransaction.partialSign(feePayer);
    const txnSignature = await connection.sendRawTransaction(
      recoveredTransaction.serialize()
    );
    return txnSignature;
  } catch (error) {
    // Handle errors during transaction signing and submission
    throw error;
  }
}

// Function to update multiple NFTs from a JSON file
async function updateNFTsFromJson(jsonFilePath) {
  try {
    // Read the JSON file as a string and parse it to an array
    const rawData = await fs.promises.readFile(jsonFilePath);
    const nftDataArray = JSON.parse(rawData.toString('utf-8'));

    // Iterate through each NFT data and update them
    for (const nftData of nftDataArray) {
      await updateNFT(API_KEY, nftData, PRIVATE_KEY_BASE64);
    }
  } catch (error) {
    console.error(`Error reading or parsing ${jsonFilePath}:`, error);
  }
}

// Function to interactively prompt for updating a single NFT
async function promptForSingleUpdate() {
  console.clear();

  console.log(`
  ██████╗ ██╗   ██╗██╗██╗     ██████╗ ███████╗██████╗ ██████╗ ██╗   ██╗
  ██╔══██╗██║   ██║██║██║     ██╔══██╗██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝
  ██████╔╝██║   ██║██║██║     ██║  ██║█████╗  ██████╔╝██████╔╝ ╚████╔╝ 
  ██╔══██╗██║   ██║██║██║     ██║  ██║██╔══╝  ██╔══██╗██╔══██╗  ╚██╔╝  
  ██████╔╝╚██████╔╝██║███████╗██████╔╝███████╗██║  ██║██████╔╝   ██║   
  ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝   
                                                                       
    Welcome to the NFT Updater CLI! Powered by Shyft®
  `);

  // Define questions to gather NFT update information
  const questions = [
    {
      name: "network",
      message: "Enter the network (testnet/devnet/mainnet-beta):",
    },
    { name: "token_address", message: "Enter the token address:" },
    {
      name: "update_authority_address",
      message: "Enter the update authority address:",
    },
    {
      name: "name",
      message: "Enter the NFT name (optional, leave blank if not updating):",
      default: "",
    },
    {
      name: "symbol",
      message: "Enter the NFT symbol (optional, leave blank if not updating):",
      default: "",
    },
    {
      name: "description",
      message:
        "Enter the NFT description (optional, leave blank if not updating):",
      default: "",
    },
    {
      type: "input",
      name: "attributes",
      message:
        "Enter the attributes in JSON format (optional, leave blank if not updating):",
      default: "",
      validate: (input) => {
        if (input === "") return true;
        try {
          JSON.parse(input);
          return true;
        } catch (e) {
          return "Invalid JSON format!";
        }
      },
    },
    {
      name: "royalty",
      message:
        "Enter the royalty (0-100, optional, leave blank if not updating):",
      default: "",
    },
    {
      name: "imageFilePath",
      message:
        "Enter the path to image file (optional, leave blank if not updating):",
      default: "",
    },
    {
      name: "data",
      message:
        "Enter the path to digital data file (optional, leave blank if not updating):",
      default: "",
    },
    {
      name: "fee_payer_address",
      message: "Enter the fee payer address that should pay the fee to update (optional, leave blank if update_authority_address should pay the fee):",
      default: "",
    },
  ];

// Prompt the user for NFT update information
  const answers = await inquirer.prompt(questions);
  await updateNFT(API_KEY, answers, PRIVATE_KEY_BASE64);
}

// Main function to run the NFT updater
async function run() {
  console.clear();

  console.log(`
  ██████╗ ██╗   ██╗██╗██╗     ██████╗ ███████╗██████╗ ██████╗ ██╗   ██╗
  ██╔══██╗██║   ██║██║██║     ██╔══██╗██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝
  ██████╔╝██║   ██║██║██║     ██║  ██║█████╗  ██████╔╝██████╔╝ ╚████╔╝ 
  ██╔══██╗██║   ██║██║██║     ██║  ██║██╔══╝  ██╔══██╗██╔══██╗  ╚██╔╝  
  ██████╔╝╚██████╔╝██║███████╗██████╔╝███████╗██║  ██║██████╔╝   ██║   
  ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝   
                                                                       
    Welcome to the NFT Updater CLI! Powered by Shyft®
  `);
  const { updateMode, keys } = await inquirer.prompt([
    {
      type: "list",
      name: "updateMode",
      message: "Would you like to update a single NFT or multiple NFTs?",
      choices: ["Single", "Multiple"],
    },
    {
      when: (answers) => answers.updateMode === "Single",
      name: "keys",
      message: "Do you want to enter your private keys now? We do not store them anywhere but your local machine in the .env file so the script can use them. We will use these keys to sign the transaction. They are needed to update the NFT.",
      type: "confirm",
      default: true,
    },
  ]);

  if (updateMode === "Single") {
    if (keys) {
      const { privateKey, feePayerAddress, feePayerPrivateKey } = await promptForKeys();
      await promptForSingleUpdate(privateKey, feePayerAddress, feePayerPrivateKey);
    } else {
      await promptForSingleUpdate();
    }
  } else {
    const { jsonFilePath } = await inquirer.prompt([
      {
        type: "input",
        name: "jsonFilePath",
        message: "Enter the path to your JSON file:",
        validate: (input) => fs.existsSync(input) || "File does not exist!",
      },
    ]);

    await updateNFTsFromJson(jsonFilePath);
  }
}

// Start the NFT updater
run().catch(console.error);