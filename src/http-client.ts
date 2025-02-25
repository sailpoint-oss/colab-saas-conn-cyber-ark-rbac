import { ConnectorError, logger, StdTestConnectionOutput } from '@sailpoint/connector-sdk'
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export class HTTPClient {
    private clientId: string
    private clientSecret: string
    private oauthAppId: string
    private oauthScope: string
    private directoryServiceId: string
    private accessToken?: string
    private identityTenantUrl?: string

    constructor(config: any) {
        this.identityTenantUrl = config.identityTenantUrl
        this.clientId = config.clientId
        this.clientSecret = config.clientSecret
        this.oauthAppId = config.oauthAppId
        this.oauthScope = config.oauthScope
        this.directoryServiceId = config.directoryServiceId

        if (config.ignoreSSL) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        }
    }

    getEndpoint(service: string): string {
        let endpoint: string = ''
        const baseUrl = this.identityTenantUrl
        switch (service) {
            case 'user':
                endpoint = `${baseUrl}/scim/v2/users`
                break
            case 'group':
                endpoint = `${baseUrl}/scim/v2/groups`
                break
            case 'container':
                endpoint = `${baseUrl}/scim/v2/containers`
                break
            case 'containerPermissions':
                endpoint = `${baseUrl}/scim/v2/containerpermissions`
                break
            case 'directoryServiceQuery':
                endpoint = `${baseUrl}/UserMgmt/DirectoryServiceQuery`
                break
            case 'inviteUsers':
                endpoint = `${baseUrl}/UserMgmt/InviteUsers`
                break
            case 'role':
                endpoint = `${baseUrl}/Roles/GetRole`
                break
        }
        return endpoint
    }

    async getAccessToken(): Promise<string | undefined> {
        const request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.identityTenantUrl,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            data: `client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials&scope=${this.oauthScope}`,
            url: `/oauth2/token/${this.oauthAppId}`,
        }
        const url = axios.getUri(request)

        const response: AxiosResponse = await axios(request)
        this.accessToken = response.data.access_token

        return this.accessToken
    }

    async getAllAccounts(filter: string = ''): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
 
        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('user'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            url: filter
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'List Accounts - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform List Accounts`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform List Accounts - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getAccount(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('user'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            url: `/${id}`,
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Get Account - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Get Account`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Get Account - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getAllGroups(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('group'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'List Groups - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform List Groups`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform List Groups - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async updateGroup(id: string,body: object): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'patch',
            baseURL: this.getEndpoint('group'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            url: `/${id}`,
            data: body
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Update Group - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Update Group`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Update Group - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getRole(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.getEndpoint('role'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            data: {"Name": id}
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Get Role - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Get Role`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Get Role - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getAllSafes(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('container'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'List Safes - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform List Safes`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform List Safes - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getAllSafePermissions(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('containerPermissions'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Get Safe Permissions - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Get Safe Permissions`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Get Safe Permissions - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getUserSafePermissions(filter: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.getEndpoint('containerPermissions'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            url: `?filter=${filter}`,
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Get User Safe Permissions - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Get User Safe Permissions`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Get User Safe Permissions - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async manageSafePermissions(id: string,requestBody: object,method: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: method,
            baseURL: this.getEndpoint('containerPermissions'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            data: requestBody
        }

        if(method == 'put' || method == 'delete'){
            request.url = `/${id}`
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Manage Safe Permissions - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Manage Safe Permissions`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Manage Safe Permissions - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async getUserId(identity: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const requestBody = {
            user: `{"_and":[{"SystemName":{"_like":"${identity}"}},{"ObjectType":"user"}]}`,
            directoryServices: [this.directoryServiceId],
        }

        let request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.identityTenantUrl,
            url: this.getEndpoint('directoryServiceQuery'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            data: requestBody,
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Get User Id - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Get User Id`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Manage Get User Id - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async createUesrInvite(id: string,userName: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()

        let request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.identityTenantUrl,
            url: this.getEndpoint('inviteUsers'),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            data: {
                "EmailInvite": false,
                "Entities": [
                    {
                        "Type": "user",
                        "Guid": id,
                        "Name": userName
                    }
                ]
            }
        }

        return axios(request)
            .then((response) => {
                logger.info({
                    message: 'Create User Invite - Success',
                    statusCode: response.status,
                    response: response.data,
                })
                return response
            })
            .catch((error) => {
                logger.error({
                    message: `Issue when trying to perform Create User Invite`,
                    statusCode: error.response?.status,
                    response: error.response?.data,
                    stack: error.stack,
                })

                throw new ConnectorError(
                    `Issue when trying to perform Create User Invite - ${error.response?.status} - ${error.response?.data}`
                )
            })
    }

    async testConnection(): Promise<any> {
        const identity_token = await this.getAccessToken()

        if (identity_token) {
            return {}
        } else {
            throw new ConnectorError('Unable to retrieve access token, please see logs for more details')
        }
    }
}
