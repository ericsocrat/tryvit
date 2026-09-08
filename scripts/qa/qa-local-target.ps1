function Assert-QaLocalEnvironment {
    param([hashtable]$Settings)
    if ($Settings.PGSERVICE -or $Settings.PGSERVICEFILE) { throw 'QA_IMPLICIT_SERVICE_ROUTING_DENIED' }
    if ($Settings.PGDATABASE -and $Settings.PGDATABASE -notmatch '^[A-Za-z0-9_-]+$') { throw 'QA_DATABASE_CONNINFO_DENIED' }
    if ($Settings.PGHOSTADDR -and $Settings.PGHOSTADDR -notin @('127.0.0.1', '::1')) { throw 'QA_REMOTE_HOSTADDR_DENIED' }
    if ($Settings.PGHOST) {
        if ($Settings.PGHOST -notin @('127.0.0.1', 'localhost', '::1')) { throw 'QA_REMOTE_HOST_DENIED' }
        return 'direct'
    }
    if ($Settings.PGHOSTADDR) { throw 'QA_IMPLICIT_HOSTADDR_DENIED' }
    if ($Settings.DOCKER_HOST -and $Settings.DOCKER_CONTEXT) { throw 'QA_AMBIGUOUS_DOCKER_ROUTING_DENIED' }
    if ($Settings.DOCKER_HOST -and $Settings.DOCKER_HOST -notmatch '^(npipe:/{4}\./pipe/|unix:///)') { throw 'QA_REMOTE_DOCKER_DENIED' }
    return 'docker'
}

function Assert-QaLocalDockerEndpoint {
    param([string]$Endpoint)
    if ($Endpoint -notmatch '^(npipe:/{4}\./pipe/|unix:///)') { throw 'QA_REMOTE_DOCKER_DENIED' }
}

function Assert-QaOwnedDockerProject {
    param([string]$Project)
    if ($Project -ne 'tryvit') { throw 'QA_DOCKER_OWNERSHIP_UNPROVEN' }
}
