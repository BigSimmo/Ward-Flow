targetScope = 'resourceGroup'

@allowed(['australiaeast', 'australiasoutheast'])
param location string = 'australiaeast'
param serverName string = 'wardflow-dev-pg-aue'
param tenantId string
param administratorObjectId string
param administratorName string
@allowed(['User', 'ServicePrincipal'])
param administratorType string = 'User'
@allowed([7, 14, 35])
param backupRetentionDays int = 35

resource network 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'vnet-wardflow-dev-aue'
  location: location
  tags: {
    application: 'Ward Flow'
    classification: 'synthetic'
  }
  properties: {
    addressSpace: { addressPrefixes: ['10.74.0.0/16'] }
    subnets: [
      {
        name: 'database'
        properties: {
          addressPrefix: '10.74.1.0/24'
          delegations: [
            {
              name: 'postgres'
              properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' }
            }
          ]
        }
      }
      {
        name: 'functions'
        properties: {
          addressPrefix: '10.74.2.0/24'
          delegations: [
            {
              name: 'functions'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
        }
      }
    ]
  }
}
resource dns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: '${serverName}.private.postgres.database.azure.com'
  location: 'global'
}
resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dns
  name: 'wardflow'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: network.id }
  }
}
resource database 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: {
    application: 'Ward Flow'
    classification: 'synthetic'
  }
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
      tenantId: tenantId
    }
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: {
      delegatedSubnetResourceId: '${network.id}/subnets/database'
      privateDnsZoneArmResourceId: dns.id
      publicNetworkAccess: 'Disabled'
    }
  }
  dependsOn: [dnsLink]
}
resource administrator 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: database
  name: administratorObjectId
  properties: {
    principalName: administratorName
    principalType: administratorType
    tenantId: tenantId
  }
}
resource wardflow 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: database
  name: 'wardflow'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}
output databaseResourceId string = database.id
output databaseHost string = database.properties.fullyQualifiedDomainName
output functionSubnetId string = '${network.id}/subnets/functions'
