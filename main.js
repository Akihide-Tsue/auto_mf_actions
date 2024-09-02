'use strict';
require('dotenv').config();
// const { google } = require('googleapis');
const { IncomingWebhook } = require("@slack/webhook");
const puppeteer = require('puppeteer');
const { setTimeout } = require("timers/promises");

(async () => {


  const mfPuppeteer = async (currentHour) => {
    const isProd = true
    // const isProd = false
    const delayTime = isProd ? 10000 : 3000

    let browser // browser変数を定義

    try {
      browser = await puppeteer.launch({
        headless: isProd, //ブラウザ起動（本番ではtrue）
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--window-size=1920,1080'
        ]
      })

      await setTimeout(2000)

      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Apple Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.96 Safari/537.36');
      await page.goto('https://attendance.moneyforward.com/employee_session/new', { waitUntil: ['load', 'networkidle2'] })

      await page.click('a[class="attendance-button-mfid attendance-button-link attendance-button-size-wide"]')
      console.log('ページ遷移')

      // TODO toBeVisible()に変更

      await setTimeout(delayTime)
      await page.type('input[name="mfid_user[email]"]', process.env.MF_ID)
      await setTimeout(2000)
      await page.click('button[id="submitto"]')
      await setTimeout(2000)
      console.log('パスワード画面')
      await page.type('input[name="mfid_user[password]"]', process.env.MF_PASSWORD)
      await setTimeout(delayTime)
      await page.click('button[id="submitto"]')
      console.log('ログイン完了')
      await setTimeout(delayTime)

      await page.evaluate(async () => {
        window.scrollTo({
          left: document.body.scrollWidth, // ページの最大スクロール幅
          behavior: 'smooth'
        });

        // 2番目の"選択"ボタンをXPathで検索します
        const buttonXPath = '(//a[contains(text(), "選択")])[2]'
        const button = document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        await page.screenshot({ path: 'error_screenshot.png' });

        if (button) {
          await setTimeout(1000)

          button.click()
        } else {
          throw new Error('2番目の"選択"ボタンが見つかりませんでした')
        }
      })

      console.log("事業者選択OK")
      await setTimeout(delayTime)

      // 18時以降（退勤） 19時はcurrentHour===10
      if (currentHour > 8) {
        await page.evaluate(() => {
          const buttonXPath = '//button[contains(text(), "退勤")]'
          const button = document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
          if (button) {
            button.click()
          } else throw new Error('退勤ボタンが見つかりませんでした')
        })
      } else {
        await page.evaluate(() => {
          const buttonXPath = '//button[contains(text(), "出勤")]'
          const button = document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
          if (button) {
            button.click()
          } else throw new Error('出勤ボタンが見つかりませんでした')
        })
      }

      const date = new Date().getMonth() + '月' + new Date().getDate() + '日' + new Date().getHours() + '時 '
      console.log(date, '打刻完了')
      await setTimeout(delayTime)
      await browser.close()
    } catch (error) {
      await browser.close()
      throw new Error(error)
    }
    await browser.close()
  }

  try {
    const currentHour = new Date().getHours()
    console.log('-----開始-----',)
    console.log("new Date()", new Date())

    const now = new Date()
    now.setHours(now.getHours() + 9); // 9時間足す
    console.log("日本時刻", now)

    await mfPuppeteer(currentHour)

  } catch (error) {
    console.log('The API returned an error: ' + error)
    //Slack通知
    const webhook = new IncomingWebhook(process.env.SLACK_HOOK_URL)
    webhook.send({
      text: "<!channel>\n打刻失敗：\n" + error,
      username: "MF勤怠", //通知のユーザー名
      icon_url: 'https://thumb.ac-illust.com/90/90bae316d037441107ac7354f53f991c_t.jpeg',
    })
    return
  }

})()
