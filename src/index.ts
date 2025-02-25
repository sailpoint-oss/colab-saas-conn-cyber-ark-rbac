import {
    Context,
    ConnectorError,
    createConnector,
    readConfig,
    Response,
    StdAccountCreateInput,
    StdAccountCreateOutput,
    StdAccountListInput,
    StdAccountListOutput,
    StdAccountReadInput,
    StdAccountReadOutput,
    StdAccountUpdateInput,
    StdAccountUpdateOutput,
    StdEntitlementListOutput,
    StdEntitlementReadOutput,
    StdEntitlementReadInput,
    StdTestConnectionInput,
    StdTestConnectionOutput,
    AttributeChangeOp,
    StdAccountDisableInput,
    StdAccountDisableOutput,
    StdAccountEnableOutput,
    StdAccountEnableInput,
    AttributeChange,
    logger,
} from '@sailpoint/connector-sdk'
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { HTTPClient } from './http-client'
import { Account } from './model/account'
import { Group } from './model/group'
import { SafeRole } from './model/safeRole'
import { SafeRight } from './model/safeRight'

export const connector = async () => {
    const config = await readConfig()
    const httpClient = new HTTPClient(config)

    const readAccount = async (id: string, safe_permissions?: AxiosResponse): Promise<Account> => {
        const account_response: AxiosResponse = await httpClient.getAccount(id)
        const account_groups: string[] = account_response.data.groups?.map((group: any) => group.value)

        if (!safe_permissions) {
            safe_permissions = await httpClient.getUserSafePermissions(
                `user.display eq "${account_response.data.userName}"`
            )
        } else {
            safe_permissions.data.Resources = safe_permissions.data.Resources.filter(
                (resource: any) => resource.user?.value === id
            )
        }
        let safe_roles = []
        let safe_rights = []

        if (safe_permissions.data.totalResults > 0) {
            for (const safe of safe_permissions.data.Resources) {
                for (const role of JSON.parse(config.safeRoles)) {
                    const match =
                        role.rights.length === safe.rights.length &&
                        role.rights.every((value: string) => safe.rights.includes(value))

                    if (match) {
                        safe_roles.push(`${safe.container.value} - ${role.name}`)
                    }
                }
                for (const role of safe.rights) {
                    safe_rights.push(`${safe.container.value} - ${role}`)
                }
            }
        }

        const account: Account = new Account({
            id: account_response.data.id,
            userName: account_response.data.userName,
            active: account_response.data.active,
            groups: account_groups,
            safeRoles: safe_roles,
            safeRights: safe_rights,
        })

        return account
    }

    const modifyAccount = async (change: AttributeChange, id: string): Promise<any> => {
        switch (change.op) {
            case AttributeChangeOp.Add:
                //Adds User to a CyberArk Group
                if (change.attribute === 'groups') {
                    const patch_body = {
                        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                        Operations: [
                            {
                                op: 'add',
                                path: 'members',
                                value: [
                                    {
                                        value: id,
                                    },
                                ],
                            },
                        ],
                    }
                    await httpClient.updateGroup(change.value, patch_body)
                }
                //Adds or updates container permissions for user on a specific safe
                if (change.attribute === 'safeRoles' || change.attribute === 'safeRights') {
                    //Checks if user has any existing permissions on the requested safe
                    const safe_id = change.value.substring(0, change.value.indexOf(' -'))
                    const container_permissions = await httpClient.getUserSafePermissions(
                        `user.value eq "${id}" and container.value eq "${safe_id}"`
                    )
                    let requestBody = {}
                    let requestType: string = ''

                    if (container_permissions.data.totalResults > 0) {
                        requestType = 'put'
                    }
                    if (container_permissions.data.totalResults == 0) {
                        requestType = 'post'
                    }

                    if (change.attribute === 'safeRoles') {
                        const roles = JSON.parse(config.safeRoles)
                        const safe_role = roles.find(
                            (role: any) => role.name === change.value.slice(change.value.indexOf('-') + 2)
                        )

                        requestBody = {
                            schemas: ['urn:ietf:params:scim:schemas:pam:1.0:ContainerPermission'],
                            user: {
                                value: id,
                            },
                            container: {
                                name: safe_id,
                            },
                            rights: safe_role.rights,
                        }
                    }

                    if (change.attribute === 'safeRights') {
                        let safe_rights: any = []
                        if (container_permissions.data.totalResults > 0) {
                            safe_rights = container_permissions.data.Resources[0].rights
                        }
                        safe_rights.push(change.value.slice(change.value.indexOf('-') + 2))

                        requestBody = {
                            schemas: ['urn:ietf:params:scim:schemas:pam:1.0:ContainerPermission'],
                            user: {
                                value: id,
                            },
                            container: {
                                name: safe_id,
                            },
                            rights: safe_rights,
                        }
                    }

                    await httpClient.manageSafePermissions(
                        container_permissions.data.Resources?.[0].id,
                        requestBody,
                        requestType
                    )
                }

                break

            case AttributeChangeOp.Remove:
                if (change.attribute === 'groups') {
                    const patch_body = {
                        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                        Operations: [
                            {
                                op: 'remove',
                                path: `members[value eq \"${id}\"]`,
                            },
                        ],
                    }
                    await httpClient.updateGroup(change.value, patch_body)
                }

                if (change.attribute === 'safeRoles' || change.attribute === 'safeRights') {
                    //Checks if user has any existing permissions on the requested safe
                    const safe_id = change.value.substring(0, change.value.indexOf(' -'))
                    const container_permissions = await httpClient.getUserSafePermissions(
                        `user.value eq "${id}" and container.value eq "${safe_id}"`
                    )
                    let requestBody: any = {}
                    let safe_rights: any = []
                    let requestType: string = ''

                    if (change.attribute === 'safeRoles') {
                        //Check to see if there are any other rights outside of the safe role, remove the safe role rights from the array, and run put command
                        for (const role of JSON.parse(config.safeRoles)) {
                            const match =
                                role.rights.length === container_permissions.data.Resources[0].rights.length &&
                                role.rights.every((value: string) =>
                                    container_permissions.data.Resources[0].rights.includes(value)
                                )

                            if (match) {
                                requestBody = null
                                requestType = 'delete'
                            } else {
                                safe_rights = container_permissions.data.Resources[0].rights.filter(
                                    (right: string) => !role.rights.includes(right)
                                )
                                requestType = 'put'

                                requestBody = {
                                    schemas: ['urn:ietf:params:scim:schemas:pam:1.0:ContainerPermission'],
                                    user: {
                                        value: id,
                                    },
                                    container: {
                                        name: safe_id,
                                    },
                                    rights: safe_rights,
                                }
                            }
                        }
                    }

                    if (change.attribute === 'safeRights') {
                        safe_rights = container_permissions.data.Resources[0].rights.filter(
                            (right: string) => right !== change.value.slice(change.value.indexOf('-') + 2)
                        )

                        requestType = 'put'
                        requestBody = {
                            schemas: ['urn:ietf:params:scim:schemas:pam:1.0:ContainerPermission'],
                            user: {
                                value: id,
                            },
                            container: {
                                name: safe_id,
                            },
                            rights: safe_rights,
                        }
                    }

                    await httpClient.manageSafePermissions(
                        container_permissions.data.Resources[0].id,
                        requestBody,
                        requestType
                    )
                }

                break
            default:
                throw new ConnectorError(`Operation not supported: ${change.op}`)
        }
    }

    return createConnector()
        .stdTestConnection(
            async (context: Context, input: StdTestConnectionInput, res: Response<StdTestConnectionOutput>) => {
                res.send(await httpClient.testConnection())
            }
        )
        .stdAccountList(async (context: Context, input: StdAccountListInput, res: Response<StdAccountListOutput>) => {
            const accounts: AxiosResponse = await httpClient.getAllAccounts()
            const safe_permissions: AxiosResponse = await httpClient.getAllSafePermissions()

            if (accounts.data.Resources) {
                for (const acc of accounts.data.Resources) {
                    const account_groups: string[] = acc.groups?.map((group: any) => group.value)

                    const user_safe_permissions = safe_permissions.data.Resources.filter(
                        (resource: any) => resource.user?.value === acc.id
                    )

                    let safe_roles = []
                    let safe_rights = []

                    for (const safe of user_safe_permissions) {
                        for (const role of JSON.parse(config.safeRoles)) {
                            const match =
                                role.rights.length === safe.rights.length &&
                                role.rights.every((value: string) => safe.rights.includes(value))

                            if (match) {
                                safe_roles.push(`${safe.container.value} - ${role.name}`)
                            }
                        }
                        for (const role of safe.rights) {
                            safe_rights.push(`${safe.container.value} - ${role}`)
                        }
                    }

                    const account: Account = new Account({
                        id: acc.id,
                        userName: acc.userName,
                        active: acc.active,
                        groups: account_groups,
                        safeRoles: safe_roles,
                        safeRights: safe_rights,
                    })
                    res.send(account)
                }
            }
        })
        .stdAccountRead(async (context: Context, input: StdAccountReadInput, res: Response<StdAccountReadOutput>) => {
            const account = await readAccount(input.identity)

            res.send(account)
        })
        .stdAccountCreate(
            async (context: Context, input: StdAccountCreateInput, res: Response<StdAccountCreateOutput>) => {
                //Checks to see if account already exists, in case it was created outside of IdN in between aggregations
                logger.info(JSON.stringify(input))
                let account

                const account_query = await httpClient.getAllAccounts(
                    `?filter=userName eq "${input.attributes.userName}"`
                )
                if (account_query.data.totalResults > 0) {
                    account = await readAccount(account_query.data.Resources[0].id)
                    logger.info(`A new account for ${input.attributes.userName} will not be created because
                        an existing account was found with the same email address - account id is ${account.attributes.id}`)
                } else {
                    const directory_query = await httpClient.getUserId(input.attributes.userName)
                    await httpClient.createUesrInvite(
                        directory_query.data.Result.User.Results[0].Entities[0].Key,
                        input.attributes.userName
                    )
                    account = await readAccount(directory_query.data.Result.User.Results[0].Entities[0].Key)
                }

                if (input.attributes.groups) {
                    if (Array.isArray(input.attributes.groups)) {
                        for (const group of input.attributes.groups) {
                            const change: AttributeChange = {
                                op: AttributeChangeOp.Add,
                                attribute: 'groups',
                                value: group,
                            }

                            await modifyAccount(change, account.identity)
                        }
                    } else if (typeof input.attributes.groups === 'string') {
                        const change: AttributeChange = {
                            op: AttributeChangeOp.Add,
                            attribute: 'groups',
                            value: input.attributes.groups,
                        }

                        await modifyAccount(change, account.identity)
                    }
                }
                if (input.attributes.safeRoles) {
                    if (Array.isArray(input.attributes.safeRoles)) {
                        for (const role of input.attributes.safeRoles) {
                            const change: AttributeChange = {
                                op: AttributeChangeOp.Add,
                                attribute: 'safeRoles',
                                value: role,
                            }

                            await modifyAccount(change, account.identity)
                        }
                    } else if (typeof input.attributes.safeRoles === 'string') {
                        const change: AttributeChange = {
                            op: AttributeChangeOp.Add,
                            attribute: 'safeRoles',
                            value: input.attributes.safeRoles,
                        }

                        await modifyAccount(change, account.identity)
                    }
                }
                if (input.attributes.safeRights) {
                    if (Array.isArray(input.attributes.safeRights)) {
                        for (const right of input.attributes.safeRights) {
                            const change: AttributeChange = {
                                op: AttributeChangeOp.Add,
                                attribute: 'safeRights',
                                value: right,
                            }

                            await modifyAccount(change, account.identity)
                        }
                    } else if (typeof input.attributes.safeRights === 'string') {
                        const change: AttributeChange = {
                            op: AttributeChangeOp.Add,
                            attribute: 'safeRights',
                            value: input.attributes.safeRights,
                        }

                        await modifyAccount(change, account.identity)
                    }
                }

                account = await readAccount(account.identity)
                res.send(account)
            }
        )

        .stdAccountUpdate(
            async (context: Context, input: StdAccountUpdateInput, res: Response<StdAccountUpdateOutput>) => {
                logger.info(JSON.stringify(input))
                for (const change of input.changes) {
                    await modifyAccount(change, input.identity)
                }
                const account = await readAccount(input.identity)
                res.send(account)
            }
        )
        .stdEntitlementList(async (context: Context, input: any, res: Response<StdEntitlementListOutput>) => {
            logger.info(`Aggregating entitlement type ${input.type}...`)
            if (input.type == 'group') {
                const group_response = await httpClient.getAllGroups()
                for (const group of group_response.data.Resources) {
                    const role = await httpClient.getRole(group.id)
                    const response: Group = new Group({
                        id: group.id,
                        displayName: group.displayName,
                        description: role.data.Result.Description,
                    })
                    res.send(response)
                }
            }

            if (input.type == 'safeRight' || input.type == 'safeRole') {
                const safe_response = await httpClient.getAllSafes()
                const safe_roles = JSON.parse(config.safeRoles)
                const safe_rights = JSON.parse(config.safeRights)

                if (safe_response.data.totalResults > 0) {
                    for (const safe of safe_response.data.Resources) {
                        if (input.type == 'safeRole') {
                            for (const role of safe_roles) {
                                const response: SafeRole = new SafeRole({
                                    id: `${safe.id} - ${role.name}`,
                                    displayName: `${safe.id} - ${role.name}`,
                                    description: role.description,
                                })
                                res.send(response)
                            }
                        }
                        if (input.type == 'safeRight') {
                            for (const right of safe_rights) {
                                const response: SafeRight = new SafeRight({
                                    id: `${safe.id} - ${right.name}`,
                                    displayName: `${safe.id} - ${right.name}`,
                                    description: right.description,
                                })
                                res.send(response)
                            }
                        }
                    }
                }
            }
        })
}
