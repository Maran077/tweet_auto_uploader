import puppeteer, { CookieParam, ElementHandle, Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
// import puppeteer, { CookieParam, ElementHandle, Page } from "puppeteer";
import snoowrap from "snoowrap";
import https from "https";
import fs from "fs";
import { config } from "dotenv";
config();

import express from "express";

const app = express();

// console.log("USER_AGENT:", process.env.USER_AGENT);
// console.log("CLIENT_ID:", process.env.CLIENT_ID);
// console.log("CLIENT_SECRET:", process.env.CLIENT_SECRET);
// console.log("USERNAME:", process.env.USERNAME);
// console.log("PASSWORD:", process.env.PASSWORD);

// Reddit credentials
const reddit = new snoowrap({
  userAgent: process.env.USER_AGENT || "",
  clientId: process.env.CLIENT_ID || "",
  clientSecret: process.env.CLIENT_SECRET || "",
  username: process.env.USER_NAME || "",
  password: process.env.PASSWORD || "",
});

const cookies: CookieParam[] = [
  {
    domain: ".x.com",
    //   expirationDate: 1763575208,
    //   hostOnly: false,
    httpOnly: true,
    name: "auth_token",
    path: "/",
    sameSite: "None",
    secure: true,
    //   session: false,
    //   storeId: "0",
    value: process.env.TWITTER_BEARER_TOKEN || "",
  },

  {
    domain: ".x.com",
    //   expirationDate: 1760551316,
    //   hostOnly: false,
    httpOnly: false,
    name: "twid",
    path: "/",
    sameSite: "None",
    secure: true,
    //   session: false,
    //   storeId: "0",
    value: process.env.TWITTER_USER_ID || "",
  },
];
// Function to delete the image after upload
async function deletePicture(fileName: string) {
  fs.unlink(fileName, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
    } else {
      console.log(`File ${fileName} deleted successfully.`);
    }
  });
}
interface DownloadResult {
  success: boolean;
  fileName: string;
}

// let previousUrl: string = "";

async function getPicture(): Promise<DownloadResult> {
  const r: DownloadResult = { success: false, fileName: "" };

  return reddit
    .getSubreddit("memes")
    .getNew({ limit: 1 })
    .then((posts) => {
      if (posts.length > 0) {
        const post = posts[0];
        const imageUrl = post.url; // Get the image URL from the post

        console.log(`Image URL: ${imageUrl}`);

        // Download the image if it has a valid extension
        if (
          imageUrl.endsWith(".jpg") ||
          imageUrl.endsWith(".png") ||
          imageUrl.endsWith(".jpeg")
          // &&
          // imageUrl !== previousUrl
        ) {
          const fileName = "meme.jpg";
          const file = fs.createWriteStream(fileName);
          // previousUrl = imageUrl;
          return new Promise<DownloadResult>((resolve, reject) => {
            https
              .get(imageUrl, (response) => {
                response.pipe(file);

                file.on("finish", () => {
                  file.close(() => {
                    r.fileName = fileName;
                    r.success = true;
                    console.log("Image downloaded successfully.");
                    resolve(r);
                  });
                });
              })
              .on("error", (err) => {
                fs.unlink(fileName, () => {
                  console.error("Error downloading image:", err);
                });
                reject(err);
              });
          });
        } else {
          console.log("No image found in the post.");
          return r;
        }
      } else {
        console.log("No posts found.");
        return r;
      }
    })
    .catch((err) => {
      console.error("Error fetching posts:", err);
      return r;
    });
}

async function waitForEnabledButton(page: Page, selector: string) {
  await page.waitForSelector(selector, { visible: true });
  await page.waitForFunction(
    (selector) => {
      const button: HTMLButtonElement | null = document.querySelector(selector);
      return !button?.disabled;
    },
    {},
    selector
  );
}

function waitForSeconds() {
  const seconds = 20;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("20 seconds have passed");
    }, seconds * 1000);
  });
}

async function uploadMeme() {
  let browser;
  let r = {
    success: false,
    html: "",
  };
  try {
    // // const { fileName, success } = await getPicture(); // Download image
    // console.log(fileName, success);

    // if (!success) return; // Exit if download fails
    // console.log("start");

    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      executablePath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
      // headless: false,
    });
    const page = await browser.newPage();

    await page.setCookie(...cookies);

    await page.goto("https://x.com");
    await waitForSeconds();
    const title = await page.title();
    console.log("title: ", title);

    console.log("Goto x.com", title);
    // const html = await page.content();
    // r = {
    //   success: true,
    //   html,
    // };
    // console.log(r);

    // return r;
    // // await waitForSeconds();
    // const s = "input[data-testid=fileInput]";
    // // await page.waitForSelector(s);
    // const fileSelector: ElementHandle<HTMLInputElement> | null = await page.$(
    //   s
    // );

    // console.log("fileSelector", Boolean(fileSelector));

    // if (fileSelector) {
    //   // Upload the file
    //   await fileSelector.uploadFile(fileName);
    //   console.log("File uploaded");

    //   const btnSelector = "button[data-testid=tweetButtonInline]";
    //   const postBtn = await page.$(btnSelector);
    //   console.log("postBtn", Boolean(postBtn));

    //   // Wait until the tweet button is enabled
    //   await waitForEnabledButton(page, btnSelector);

    //   const text = await page.evaluate((el) => el?.textContent, postBtn);
    //   console.log(text);
    //   console.log("postBtn");

    //   // Wait for a few seconds (just to make sure it's ready for the click)
    //   await waitForSeconds();
    //   await postBtn?.click();
    //   console.log("postBtn clicked");

    //   // await deletePicture(fileName);
    //   await waitForSeconds();
    // }
  } catch (error) {
    console.log(error);
    return r;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

let skipRenders = 0;

app.get("/", async (req, res) => {
  if (skipRenders < 2) {
    skipRenders++;
    res.send("Hello World! skipRenders: " + skipRenders);
    return;
  }
  uploadMeme();
  res.send("h");
});

app.get("/test", (req, res) => {
  res.send("Test completed!");
});

app.listen(3001, () => {
  console.log("Server is running on port 3000");
});
// function main() {
//   const hrs = 0.18;
//   uploadMeme();
//   setInterval(() => {
//     uploadMeme();
//   }, hrs * 60 * 60 * 1000);
// }

// main();
