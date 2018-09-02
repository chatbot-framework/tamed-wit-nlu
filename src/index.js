const Promise = require('bluebird')
const clone = require('clone')
const rp = require('request-promise')

const API = {
  apps: 'https://api.wit.ai/apps',
  entities: 'https://api.wit.ai/entities',
  samples: 'https://api.wit.ai/samples',
  message: 'https://api.wit.ai/message'
}

class Wit {
  constructor(conf) {
    if (!conf) throw new Error('Parameters missing')
    if (!conf.apiVersion) throw new Error('Parameter missing: apiVersion')
    if (!conf.accessToken) throw new Error('Parameter missing: accessToken')
    this.accessToken = conf.accessToken
    this.apiVersion = conf.apiVersion
  }

  static createProject (params) {
    if (!params) return Promise.reject(
      new Error('Parameter missing'))
    if (!params.name) return Promise.reject(
      new Error('Parameter missing: name, that is project name'))
    if (!params.accessToken) return Promise.reject(
      new Error('Parameter missing: accessToken'))
    let lang = params.lang || 'en'
    let pvt = params.hasOwnProperty('private') ?
      paramts.private : false

    let options = {
      uri: `${API.apps}?version=${params.apiVersion}`,
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: {
        name: params.name,
        lang,
        private: pvt},
      json: true
    }
    return rp.post(options)
      .then((resp) => {
        return resp
      })
      .catch((err) => {
        //console.error(err)
        return Promise.reject(err)
      })
  }

  _getOptions (url, data, qs) {
    if (!url) throw new Error('Parameters missing: uri')
    let options = {
      uri: `${url}?version=${this.apiVersion}`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      json: true
    }
    if (data) options.body = data
    if (qs) options.qs = qs
    return options
  }

  _format (comps) {
    let data = {text: comps.text}
    data.entities = comps.entities ? clone(comps.entities) : []
    if (comps.intents) {
      comps.intents.forEach(intent => {
        data.entities.push({
          entity: 'intent',
          value: intent
        })
      })
    }
    return data
  }

  _listSamplesEntities (samples) {
    var entities = samples.reduce((coll, sample) => {
      if (sample.entities) {
        sample.entities.forEach(ety => {
          if (!coll[ety.entity]) coll[ety.entity] = true
        })
      }
      return coll
    }, {})
    return Object.keys(entities)
  }

  _createEntities (entities) {
    let options, that = this
    return Promise.mapSeries(entities, ety => {
      options = that._getOptions(API.entities, {id: ety})
      return rp.post(options)
    }).then(() => {
      return true
    }).catch(err => {
      console.error(err)
      return Promise.reject(new Error('WIT API error'))
    })
  }

  _newEntities (entities) {
    return rp.get(this._getOptions(API.entities))
      .then(curEntities => {
        return entities
          .filter(ety => curEntities.indexOf(ety) < 0)
      })
      .catch(err => {
        console.error(err)
        return Promise.reject(err)
      })
  }

  _createIntents (samples) {
  }

  train (samples) {
    // this is 4 step process
    // step 1 list entities from samples
    // step 2 find new entities
    // step 3 post new entities
    // step 4 final then post samples

    let witSamples = samples.map(this._format)

    let that = this
    let entities = this._listSamplesEntities(samples)
    return this._newEntities(entities)
      .then(that._createEntities.bind(that))
      .then(created => {
        if (!created) return Promise.resovel(false)
        return rp.post(that._getOptions(API.samples, witSamples))
          .then(resp => {
            return resp.success ? resp.success : false
          })
      })
      .catch(e => {
        console.error(e)
        return e
      })
  }

  test (samples) {
  }

  message (text) {
    return rp.get(this._getOptions(API.message, null, {q: text}))
    return this._getOptions(API.message, null, {
      q: encodeURIComponents(text),
      n: 3
    })
  }

  static deleteProject (params) {
    if (!params) return Promise.reject(
      new Error('Parameter missing'))
    if (!params.appId) return Promise.reject(
      new Error('Parameter missing: appId, that is project name'))
    if (!params.accessToken) return Promise.reject(
      new Error('Parameter missing: accessToken'))
    let options = {
      uri: `${API.apps}/${params.appId}`,
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json'
      },
      json: true
    }
    return rp.delete(options)
      .then(() => {
        return true
      }).catch(err => {
        console.error(err.message)
        return Promise.reject(new Error('WIT API error'))
      })
  }

  importProject (conf) {

  }

  exportProject (conf) {

  }
}

module.exports = Wit
