import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { db } from '@/db'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import {  getPineconeClient } from "@/lib/pinecone";
import { PineconeStore } from 'langchain/vectorstores/pinecone'
const f = createUploadthing();


export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
      console.log("$$$ test 1 ")
      const { getUser } = getKindeServerSession()
      const user = getUser()

      if (!user || !user.id) throw new Error('Unauthorized')
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("$$$ test 2 ")
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: file.url,
          uploadStatus: 'PROCESSING',
        },
      })

      try {
        console.log('url',file.url)
        console.log('key',file.key)
        const response = await fetch(
          `${file.url}`
        )
        console.log("response",response)
        const blob = await response.blob()
        const loader = new PDFLoader(blob)

        const pageLevelDocs = await loader.load()
        const pagesAmt = pageLevelDocs.length


        const pinecone = await getPineconeClient()
        
        
        const pineconeIndex = pinecone.Index('creditconvo')


        const embeddings = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY,
        })
        console.log(pineconeIndex)
        console.log(embeddings)
        console.log(pinecone)
        await PineconeStore.fromDocuments(
          pageLevelDocs,
          embeddings,
          {
            pineconeIndex,
            namespace: createdFile.id,
          }
        )


        await db.file.update({
          data: {
            uploadStatus: 'SUCCESS',
          },
          where: {
            id: createdFile.id,
          },
        })

      } catch (err) {
        console.log("error from core:" ,err)
        await db.file.update({
          data: {
            uploadStatus: 'FAILED',
          },
          where: {
            id: createdFile.id,
          },
        })
      }

    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;