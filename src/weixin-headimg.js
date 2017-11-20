const puppeteer = require('puppeteer')
const superagent = require('superagent')
const images = require('images')
const debug = require('debug')('src/weixin-headimg')

let browser
let page
let cookies

async function openBrowser () {
  debug('打开浏览器')
  browser = await puppeteer.launch({headless: false})
  page = await browser.newPage()
  await page.goto('https://wx2.qq.com')
  debug('请使用手机微信扫码')
  page.on('response', onResponse)
}

async function onResponse (response) {
  if (response.url.indexOf('https://wx2.qq.com/cgi-bin/mmwebwx-bin/webwxgetcontact?') !== -1) {
    cookies = (await page.cookies()).map(({name, value}) => `${name}=${value}`).join('; ')
    debug(`登录成功 ${cookies}`)
    await filterMemberList(response)
  }
}

async function filterMemberList (response) {
  // 暂时没有完全过滤出好友，里面包含好友和部分公众号的头像，ContactFlag 字段不行
  // 如有需要可以手动写到本地，然后删掉没用的，再遍历合成
  let headImgs = (await response.json())
    .MemberList
    .filter(m => m.sex !== 0 && m.UserName.indexOf('@@') !== 0)
    .map(m => superagent.get(`https://wx2.qq.com${m.HeadImgUrl}`).set('Cookie', cookies))
  debug(`正在下载 ${headImgs.length} 个好友头像`)
  headImgs = (await Promise.all(headImgs))
    .map(({body}) => wrapImage(body))
    .filter(headImg => headImg)
  debug(`成功处理 ${headImgs.length} 个好友头像`)
  await renderHeadimg(headImgs)
}

async function renderHeadimg (headImgs) {
  const size = 132
  const col = Math.ceil(Math.sqrt(headImgs.length))
  const output = images(col * size, col * size)
  let x = 0
  let y = 0
  debug(`生成 ${col}x${col} 正方形`)
  headImgs.forEach((headImg, i) => {
    y = i % col
    x = Math.floor(i / col)
    output.draw(headImg.size(size), x * size, y * size)
  })
  const fileName = 'headimg.png'
  output.save(fileName)
  await browser.close()
  debug(`合成头像成功，请在当前目录查看 ${fileName}`)
}

function wrapImage (buffer) {
  try {
    return images(buffer)
  } catch (e) {}
}

module.exports = openBrowser
