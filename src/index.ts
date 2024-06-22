import { initializeKeypair } from "./initializeKeypair"
import { Connection, clusterApiUrl, PublicKey, Signer } from "@solana/web3.js"
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
  NftWithToken,
} from "@metaplex-foundation/js"
import * as fs from "fs"

interface NftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string
}

interface CollectionNftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string
  isCollection: boolean
  collectionAuthority: Signer
}

const nftData = {
  name: "silver NFT",
  symbol: "SILVER_NFT",
  description: "this is silver's nft.",
  sellerFeeBasisPoints: 0,
  imageFile: "solana.png",
}

const updateNftData = {
  name: "Update silver NFT",
  symbol: "UPDATE_SILVER_NFT",
  description: "his is update silver's nft.",
  sellerFeeBasisPoints: 100,
  imageFile: "success.png",
}

const connection = new Connection(clusterApiUrl("devnet"))

const user =  initializeKeypair(connection)

async function uploadMetadata(
  metaplex: Metaplex,
  nftData: NftData,
): Promise<string> {
  const buffer = fs.readFileSync("src/" + nftData.imageFile);

  const file = toMetaplexFile(buffer, nftData.imageFile);

  const imageUri = await metaplex.storage().upload(file);

  console.log("image uri:", imageUri);

  const { uri } = await metaplex.nfts().uploadMetadata({
    name: nftData.name,
    symbol: nftData.symbol,
    description: nftData.description,
    image: imageUri,
  });

  console.log("metadata uri:", uri);
  return uri;
}

async function createNft(
  metaplex : Metaplex,
  uri : string,
  nftData : NftData,
  collectionMint: PublicKey
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri : uri,
      name : nftData.name,
      sellerFeeBasisPoints : nftData.sellerFeeBasisPoints,
      symbol : nftData.symbol,
      collection: collectionMint,
    },
    { commitment : "finalized" },
  );
  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  await metaplex.nfts().verifyCollection({  
    mintAddress: nft.address,
    collectionMintAddress: collectionMint,
    isSizedCollection: true,
  })

  return nft;
}

async function updateNftUri(
  metaplex: Metaplex,
  uri: string,
  mintAddress: PublicKey,
) {

  const nft = await metaplex.nfts().findByMint({ mintAddress });

  const { response } = await metaplex.nfts().update(
    {
      nftOrSft: nft,
      uri: uri,
    },
    { commitment: "finalized" },
  );

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  console.log(
    `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
  );
}

async function createCollectionNft(
  metaplex : Metaplex,
  uri : string,
  data : CollectionNftData
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri,
      name: data.name,
      sellerFeeBasisPoints: data.sellerFeeBasisPoints,
      symbol: data.symbol,
      isCollection: true,
    },
    { commitment: "finalized" }
  )

  console.log(
    `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  )
  return nft;
}


async function main() {
  
  const connection = new Connection(clusterApiUrl("devnet"))

  const user = await initializeKeypair(connection)

  console.log("PublicKey:", user.publicKey.toBase58())

  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address : "https://devnet.bundlr.network",
        providerUrl : "https://api.devnet.solana.com",
        timeout : 60000,
      })
    );
  const collectionNftData = {
    name: "SilverCNFT",
    symbol: "Silver_C",
    description: "Silver Test Description Collection",
    sellerFeeBasisPoints: 100,
    imageFile: "success.png",
    isCollection: true,
    collectionAuthority: user,
  }
  const collectionUri = await uploadMetadata(metaplex, collectionNftData);

  const collectionNft = await createCollectionNft(
    metaplex,
    collectionUri,
    collectionNftData
  )
  const uri = await uploadMetadata(metaplex, nftData);

  const nft = await createNft(metaplex, uri, nftData, collectionNft.mint.address);

  const updatedUri = await uploadMetadata(metaplex, updateNftData);

  await updateNftUri(metaplex, updatedUri, nft.address);

}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
