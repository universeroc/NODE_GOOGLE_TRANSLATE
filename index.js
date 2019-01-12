/*
* @Author: shikar
* @Date:   2017-02-05 15:28:31
* @Last Modified by:   shikar
* @Last Modified time: 2019-01-09 16:18:38
*/
'use strict'
const _ = require("lodash")
const isUrl = require("is-url")
const isNumber = require("num-or-not")
const isKeyword = require('is-keyword-js')
const querystring = require('querystring')
const got = require('got')
const safeEval = require('safe-eval')
const userAgents = require("user-agents")
const token = require('./token')
const languages = require('./languages')

function enMap(obj, path='', map=[]) {
  if (_.isObject(obj) == true) {
    _.forEach(obj, (v, k) => {
      const furKeyStr = _.isNumber(k) ? `[${k}]` : k
      const curPath = path + furKeyStr
      if (_.isObject(v) == true) {
        enMap(v, curPath, map)
      } else {
        if (_.isString(v) && !isNumber(v) && !isUrl(v) && !isKeyword(v) && !/^(?!([a-z]+|\d+|[\?=\.\*\[\]~!@#\$%\^&\(\)_+`\/\-={}:";'<>,]+)$)[a-z\d\?=\.\*\[\]~!@#\$%\^&\(\)_+`\/\-={}:";'<>,]+$/i.test(v)) {
          const lastMap = _.last(map)
          map.push({
            p: curPath,
            v: v,
            i: lastMap ? lastMap.i + lastMap.l : 0,
            l: v.split("\n").length
          })
        }
      }
    })
  } else {
    map.push({
      p: '',
      v: obj,
      i: 0,
      l: obj.split("\n").length
    })
  }
  return map
}

function deMap(src, maps, dest) {
  if (_.isObject(src) == true) {
    src = _.clone(src)
    dest = dest.split("\n")
    for (const map of maps) {
      _.set(src, map.p, _.slice(dest, map.i, map.i+map.l).join("\n"))
    }
  } else {
    src = dest
  }
  return src
}

async function translate(input, opts = {}, domain='translate.google.cn') {
  const langs = [opts.from, opts.to]
  for (const lang of langs) {
    if (lang && !languages.isSupported(lang)) {
      const e = new Error('The language \'' + lang + '\' is not supported')
      e.code = 400
      throw e
    }
  }

  opts.from = languages.getCode(opts.from || 'auto')
  opts.to = languages.getCode(opts.to || 'en')

  const strMap = enMap(input)
  const text = _.map(strMap, 'v').join("\n")
  const tokenRet = await token.get(text, domain)
  let url = `https://${domain}/translate_a/single`
  const params = {
    client: 't',
    sl: opts.from,
    tl: opts.to,
    hl: opts.to,
    dt: ['at', 'bd', 'ex', 'ld', 'md', 'qca', 'rw', 'rm', 'ss', 't'],
    ie: 'UTF-8',
    oe: 'UTF-8',
    otf: 1,
    ssel: 0,
    tsel: 0,
    kc: 7,
    q: text
  }
  params[tokenRet.name] = tokenRet.value
  const query = querystring.stringify(params)
  const opt = {headers: {'User-Agent': new userAgents({ deviceCategory: 'desktop' }).toString()}}
  
  if (query.length <= 1980) {
    url = url + '?' + query
  } else {
    delete params.q
    opt.method = 'POST'
    opt.body = `q=${text}`
    url = url + '?' + querystring.stringify(params)
  }

  try {
    const res = await got(url, opt)
    const body = safeEval(res.body)
    const retString = _.map(body[0], 0).join('')
    return deMap(input, strMap, retString)

  } catch (error) {

    let e = new Error(error.message)
    if (error.statusCode !== undefined && error.statusCode !== 200) {
      e.code = 'BAD_REQUEST'
    } else {
      e.code = 'BAD_NETWORK'
    }
    throw e
  }
}

module.exports = translate
module.exports.languages = languages
