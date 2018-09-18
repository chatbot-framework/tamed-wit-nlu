const t = require('tap')
const Wit = require('../src')
const env = require('dotenv-safe').config().parsed
const moment = require('moment')
const process = require('process')
const sinon = require('sinon')
const rp = require('request-promise')
const isClass = require('is-class')
const Promise = require('bluebird')
// to run tests with remote WIT serve
// add ACCESS_TOKEN, set TEST_WITH_REMOTE as true
// default TEST_WITH_REMOTE is false then tests are excecuted with sinon stub

const remote = env.TEST_WITH_REMOTE && env.TEST_WITH_REMOTE.toLowerCase() === 'true' ?
  true : false
const deleteProject = env.DELETE_REMOTE_PROJECT &&
  env.DELETE_REMOTE_PROJECT.toLowerCase() === 'true' ? true : false 

const samples = [{
  "intents":["travel"],
  "entities":[
    {"entity":"palce_source","value":"Navi Mumbai","start":16,"end":27},
    {"entity":"destination","value":"Goa","start":31,"end":34}],
  "text":"I am going from Navi Mumbai to Goa"
}, {
  "intents":["book-cab"],
  "entities":[
    {"entity":"capacity","value":"17 seater","start":17,"end":26},
    {"entity":"vehicle","value":"van","start":27,"end":30}],
  "text":"I am looking for 17 seater van"
}]

const entitiesForCreateEntities = ['palce_source', 'destination']
const expNewEntities = ['vehicle', 'capacity']
const newEntitiesToBeFoundFrom = ['palce_source', 'destination', 'capacity', 'vehicle']
const testMessage = "I am going from Navi Mumbai to Goa"
let wit, remoteWitDetail

t.test('static method createProject', t => {
  t.rejects(Wit.createProject({lang: 'en', private: false})
    ,'without name promise rejected')
  t.end()
})

t.test('static method createProject', t => {
  t.rejects(Wit.createProject(), 'without parameter rejects')
  t.end()
})
t.test('static method createProject', t => {
  t.rejects(Wit.createProject(), 'without parameter rejects')
  t.rejects(Wit.createProject({name: 'test-project'})
    ,'without access token promise rejected')
  t.end()
})
t.test('static method createProject', t => {
  t.equal(isClass(Wit), true, 'Wit is a class')
  t.type(Wit.createProject, 'function', 'is static method')

  // spy sinon and stub the output
  if (remote) sinon.spy(rp, 'post')
  else sinon.stub(rp, 'post')
    .resolves({"access_token" : "NEW12ACCESS12TOKEN", "app_id" : "12345678"})

  t.resolves(() => {
    return Wit.createProject({
      name: 'test-project-' + moment().format('MMM-DD-hh-mm-ss'),
      accessToken: env.ACCESS_TOKEN
    }).then((resp) => {
      console.log('Wit project created: ' + JSON.stringify(resp))
      t.equal(rp.post.called, true, 'post method of request-promise is called')
      t.type(resp, 'object', 'resolves to object')
      t.match(resp, {access_token: /[a-z|A-Z|0-9]+/}, 'has access_token')
      t.match(resp, {app_id: /[0-9]+/}, 'has app_id')
      remoteWitDetail = resp
      return Promise.resolve(resp)
    })
    .catch((err) => {
      console.error(err.message)
      t.fail('create project failed')
      return Promise.reject(err)
    })
  },'resolve create project')
  .catch((e) => {
    console.error(e)
  })
  .then(() => {
    rp.post.restore()
    t.end()
  })
})

t.test('constructor', t => {
  t.throws(() => {new Wit()}, 'throws without any parameter')
  t.throws(() => {
    new Wit({accesToken: 'xxx'})
  }, 'throws without accessToken parameter')
  t.throws(() => {
    new Wit({apiVersion: 'YYYYDDMM'})
  }, 'throws without apiVersion parameter')
  wit = new Wit({
    accessToken: remoteWitDetail.access_token,
    apiVersion: moment().format('YYYYMMDD')
  })
  t.type(wit, 'Wit', 'instance of Wit')
  t.ok(wit.accessToken, 'Wit instance has accessToken')
  t.ok(wit.apiVersion, 'Wit instance has apiVersion')
  t.end()
})

t.test('_format', t => {
  t.type(wit._format, 'function', 'is method _format')
  t.deepEqual(
    wit._format(samples[0]),
    {
      "text": "I am going from Navi Mumbai to Goa",
      "entities": [
        {"entity": "palce_source","value": "Navi Mumbai","start": 16,"end": 27},
        {"entity": "destination","value": "Goa","start": 31,"end": 34},
        {"entity": "intent","value": "travel"}
      ]
    },
    'wit sample format')
  t.end()
})

t.test('_listSamplesEntities', t => {
  let entities = wit._listSamplesEntities(samples)
  t.equal(Array.isArray(entities), true, 'output array')
  t.deepEqual(entities,
    ['palce_source', 'destination', 'capacity', 'vehicle'],
    'match output entities')
  t.end()
})

t.test('_getOptions', t => {
  let wit2 = new Wit({
    accessToken: 'abc',
    apiVersion: 'YYYYMMDD'
  })
  t.throws(() => {
    wit2._getOptions()
  }, 'throws when no parameter')
  let options = wit2._getOptions('http://host.com/path/to/uri')
  let expOptions = {
    uri: 'http://host.com/path/to/uri?version=YYYYMMDD',
    headers: {
      'Authorization': 'Bearer abc',
      'Content-Type': 'application/json'
    },
    json: true
  }
  t.deepEqual(options, expOptions, 'with url only')

  options = wit2._getOptions(
    'http://host.com/path/to/uri',
    ['foo', 'bar'],
    {id: 1})
  expOptions.body = ['foo', 'bar']
  expOptions.qs = {id: 1}
  t.deepEqual(options, expOptions, 'with url and other parameters')
  t.end()
})

t.test('_createEntities', t => {
  t.type(wit._createEntities, 'function', 'is method')
  if (remote) sinon.spy(rp, 'post')
  else sinon.stub(rp, 'post')
    .resolves({name: 'entity-name'})

  t.resolveMatch(
    wit._createEntities(entitiesForCreateEntities),
    true, 'resolves create entities'
  ).then(() => {
    t.equal(rp.post.calledTwice, true, 'post method of request-promise is called 2 times')
  }).catch((e) => {
    console.error(e)
  }).then(() => {
    rp.post.restore()
    t.end()
  })
})

t.test('_newEntities', t => {
  if (remote) sinon.spy(rp, 'get')
  else sinon.stub(rp, 'get')
    .resolves(entitiesForCreateEntities)

  wit._newEntities(newEntitiesToBeFoundFrom)
    .then(newEntities => {
      t.equal(rp.get.called, true, 'get method of request-promise is called')
      t.equal(Array.isArray(newEntities), true, 'resolves to array')
      t.deepEqual(
        newEntities.sort(),
        expNewEntities.sort(),
        'new entities')
    }).catch((e) => {
      console.error(e)
    }).then(() => {
      rp.get.restore()
      t.end()
    })
})

t.test('_createIntents', t => {
  let entities = []
  t.end()
})

// TODO stub all wit function
t.test('train', t => {
  if (remote) {
    sinon.spy(wit, '_listSamplesEntities')
    sinon.spy(wit, '_newEntities')
    sinon.spy(wit, '_createEntities')
    sinon.spy(rp, 'post')
  } else {
   sinon.stub(rp, 'get')
    .resolves(true)
  }
  t.resolves(() => {
    return wit.train(samples)
      .then((resp) => {
        //console.log(resp)
        t.equal(rp.post.callCount, 4, 'rp post call times 4')
        return resp
      }).catch((e) => {
        console.error(e)
        return e
      })

  }, 'train resolves')
  .catch(e => {
    console.error(e)
  }).then(() => {
    t.end()
  })
})

// TODO delay is not working properly in tap
t.test('message', {todo: true}, t => {
  if (remote) sinon.spy(rp, 'get')
  else sinon.stub(rp, 'get')
    .resolves()

  console.log(
    `You are testing with reome Wit server.
    Wit server accept the training the data and process it in queue.
    So setting a timeout of 30 sec`) 
  
  return Promise.delay(10000)
    .then(() => { 
      return wit.message(testMessage)
        .then(resp => {
          debugger
          t.equal(rp.get.called, true, 'get method of request-promise is called')
          t.type('object', 'output as object')
          console.log('message result:\n'+ JSON.stringify(resp, null,2))
        })
    }).catch((e) => {
      console.error(e)
    }).then(() => {
      rp.get.restore()
      t.end()
    })
})

t.test('exportProject', {todo: true}, t => {})
t.test('importProject', {todo: true}, t => {})

t.test('static deleteProject',{todo: !deleteProject}, t => {
  if (remote) sinon.spy(rp, 'delete')
  else sinon.stub(rp, 'delete')
    .resolves({success : true})

  t.resolveMatch(
    Wit.deleteProject({
      appId: remoteWitDetail.app_id,
      accessToken: env.ACCESS_TOKEN
    }),
    true, 'resolves delete project'
  ).then(() => {
    t.equal(rp.delete.called, true, 'delete method of request-promise is called 2 times')
  }).catch((e) => {
    console.error(e)
  }).then(() => {
    rp.delete.restore()
    t.end()
  })
})

