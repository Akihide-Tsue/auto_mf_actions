'use strict';
require('dotenv').config();
// const { google } = require('googleapis');
const { IncomingWebhook } = require("@slack/webhook");
const puppeteer = require('puppeteer');
const { setTimeout } = require("timers/promises");

(async () => {
  // 環境変数から認証情報を取得
  // const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  // const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  // const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  // 認証処理
  // const getGoogleOAuth = async () => {
  //   const googleOAuth = new google.auth.OAuth2(
  //     clientId,
  //     clientSecret,
  //     'http://localhost',
  //   )

  //   // 毎回のリクエスト時に新しいアクセストークンを取得
  //   googleOAuth.setCredentials({
  //     refresh_token: refreshToken,
  //   })

  //   try {
  //     const accessTokenResponse = await googleOAuth.getAccessToken()
  //     const accessToken = accessTokenResponse.token

  //     if (!accessToken)
  //       throw new Error('有効なアクセストークンを取得できませんでした')

  //     googleOAuth.setCredentials({
  //       access_token: accessToken,
  //     })

  //     return googleOAuth
  //   } catch (err) {
  //     console.log('エラーの中身', err)
  //     throw new Error('アクセストークン取得時にエラーが発生しました')
  //   }
  // }

  // カレンダーからイベントを取得
  // const getEventListFromGoogleCalendar = async (
  //   timeMin,
  //   timeMax,
  // ) => {
  //   try {
  //     const googleOAuth = await getGoogleOAuth()
  //     const calendar = google.calendar({ version: 'v3', auth: googleOAuth })

  //     const res = await calendar.events.list({
  //       calendarId: 'primary',
  //       timeMin,
  //       timeMax,
  //       timeZone: 'Asia/Tokyo',
  //     })

  //     console.log("res.data.items", res.data.items)

  //     const holidaySchedule = res.data.items.filter(item => ['打刻なし'].some(keyword => item.summary.includes(keyword)))

  //     console.log("打刻なしあり", holidaySchedule.length > 0)

  //     if (holidaySchedule.length > 0) return true
  //     else return false

  //   } catch (err) {
  //     console.log('カレンダーからイベント取得時にエラーが発生しました', err)
  //   }
  // }

  const mfPuppeteer = async (currentHour) => {
    let browser // browser変数を定義

    try {
      browser = await puppeteer.launch({
        // headless: false, //ブラウザ起動（デプロイ時はコメントアウト）
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
      })
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Macintosh Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36')
      await page.goto('https://attendance.moneyforward.com/employee_session/new', { waitUntil: ['load', 'networkidle2'] })
      // await setTimeout(Math.floor(Math.random() * 600000))//打刻時間をバラけさせる

      await page.click('a[class="attendance-button-mfid attendance-button-link attendance-button-size-wide"]')
      console.log('ページ遷移')

      // TODO toBeVisible()に変更

      await setTimeout(10000)
      await page.type('input[name="mfid_user[email]"]', process.env.MF_ID)
      await setTimeout(2000)
      await page.click('button[id="submitto"]')
      await setTimeout(2000)
      console.log('パスワード画面')
      await page.type('input[name="mfid_user[password]"]', process.env.MF_PASSWORD)
      await setTimeout(10000)
      await page.click('button[id="submitto"]')
      console.log('ログイン完了')
      await setTimeout(10000)

      await page.evaluate(() => {
        // 2番目の"選択"ボタンをXPathで検索します
        const buttonXPath = '(//a[contains(text(), "選択")])[2]'
        const button = document.evaluate(buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        if (button) {
          button.click()
        } else {
          throw new Error('2番目の"選択"ボタンが見つかりませんでした')
        }
      })

      console.log("事業者選択OK")
      await setTimeout(10000)

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
      await setTimeout(10000)
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

    // const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    // const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString()
    // console.log("startOfDay", startOfDay,)
    // console.log("endOfDay", endOfDay)

    // const isHoliday = await getEventListFromGoogleCalendar(startOfDay, endOfDay)

    // if (isHoliday) {
    //   return
    // } else {
    // }
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
