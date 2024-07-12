import { NextApiRequest, NextApiResponse } from "next";
import { bn, ContractFactory, Provider, Wallet, WalletUnlocked } from "fuels";
import { readFileSync } from "fs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requestDataSchema = z.object({
  poll_id: z.number(),
});

type requestData = z.infer<typeof requestDataSchema>;

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY environment variable");
}
const provider = await Provider.create(
  "https://testnet.fuel.network/v1/graphql"
);
const wallet: WalletUnlocked = Wallet.fromPrivateKey(privateKey, provider);
const byteCode = readFileSync(
  "./contracts/yes_no_contract/out/debug/yesno_tokens.bin"
);
const abi = JSON.parse(
  readFileSync(
    "./contracts/yes_no_contract/out/debug/yesno_tokens-abi.json",
    "utf8"
  )
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "POST") {
      try {
        let body = req.body;
        if (typeof req.body == "string") {
          body = JSON.parse(req.body);
        }

        const data: requestData = requestDataSchema.parse(body);

        const factory = new ContractFactory(byteCode, abi, wallet);
        const contract = await factory.deployContract({
          configurableConstants: {
            RESERVE_PREDICATE: {
              bits: "0xe5025c372a7af00958948961d96e67dc519606ff45ae071407085efa039de4c1",
            },
          },
        });
        const result = await prisma.poll_contracts_v2.create({
          data: {
            poll_id: data.poll_id,
            contract_id: contract.id.toHexString(),
          },
        });
        res.status(200).json({ contract_id: contract.id.toHexString() });
      } catch (err) {
        if (err instanceof z.ZodError) {
          res.status(400).json({ error: "Invalid request body" });
        } else {
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    } else {
      res.status(405).json({ error: "Method Not Allowed" });
    }
  } catch (error) {
     
    res.status(500).json({ error: "Internal Server Error" });
  }
}
