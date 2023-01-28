import json
import requests

url = requests.get('https://coveralls.io/builds/2ea77ec5eeea2351de50b268994ba69f876b815c/source.json?filename=lib%2Fcoveralls%2Fsimplecov.rb')

coverage_list = json.loads(url.text)
sum = 0
i = 0
not_zero = 0
for coverage in coverage_list:
    if coverage != None:
        sum += coverage
        i += 1
        if coverage != 0:
            not_zero += 1
ave = format(float(sum)/i, '.2f')
file = format(100*float(not_zero)/i, '.2f')
print(file)
print(ave)