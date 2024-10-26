import puppeteer, { CookieParam, ElementHandle, Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
// import puppeteer, { CookieParam, ElementHandle, Page } from "puppeteer";
import snoowrap from "snoowrap";
import https from "https";
import fs from "fs";
import express from "express";
const app = express();
const PORT = 3000;
import { config } from "dotenv";

config();
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
        ) {
          const fileName = "meme.jpg";
          const file = fs.createWriteStream(fileName);

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

function waitForSeconds(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("20 seconds have passed");
    }, seconds * 1000);
  });
}

const uploadMeme = async () => {
  try {
    const { fileName, success } = await getPicture(); // Download image
    if (!success) return; // Exit if download fails
    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      executablePath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });
    const page = await browser.newPage();

    await page.setCookie(...cookies);

    await page.goto("https://x.com");

    const s = "input[data-testid=fileInput]";
    const fileSelector: ElementHandle<HTMLInputElement> | null = await page.$(
      s
    );

    if (fileSelector) {
      // Upload the file
      await fileSelector.uploadFile(fileName);

      const btnSelector = "button[data-testid=tweetButtonInline]";
      const postBtn = await page.$(btnSelector);

      // Wait until the tweet button is enabled
      await waitForEnabledButton(page, btnSelector);

      const text = await page.evaluate((el) => el?.textContent, postBtn);
      console.log(text);

      // Wait for a few seconds (just to make sure it's ready for the click)
      await waitForSeconds(20);

      await postBtn?.click();

      await deletePicture(fileName);
    }
  } catch (error) {
    console.log(error);
  }
};

// function main() {
//   const hrs = 3.2;
//   uploadMeme();
//   setInterval(() => {
//     uploadMeme();
//   }, hrs * 60 * 60 * 1000);
// }

// main();

app.get("/upload", async (req, res) => {
  await uploadMeme();
  res.send("Meme uploaded successfully!");
});
// app.get("/upload", async (req, res) => {
//   const TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

//   const uploadMemeWithTimeout = new Promise(async (resolve, reject) => {
//     // Start the uploadMeme process
//     const uploadPromise = uploadMeme();

//     // Set up the timeout
//     const timer = setTimeout(() => {
//       reject(new Error("Upload operation timed out after 5 minutes"));
//     }, TIMEOUT);

//     try {
//       // Await uploadMeme and clear the timer if it finishes in time
//       const result = await uploadPromise;
//       clearTimeout(timer);
//       resolve(result);
//     } catch (error) {
//       clearTimeout(timer); // Ensure timer is cleared in case of errors
//       reject(error);
//     }
//   });

//   try {
//     await uploadMemeWithTimeout;
//     res.send("Meme uploaded successfully!");
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).send("Meme upload failed");
//   }
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
