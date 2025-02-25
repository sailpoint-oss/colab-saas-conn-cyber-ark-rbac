import { Attributes, StdAccountReadOutput } from '@sailpoint/connector-sdk'

export class Account {
    identity: string
    uuid: string
    attributes: Attributes
    disabled: boolean

    constructor(object: any) {
        this.attributes = {
            id: object.id?.toString(),
            active: object.active,
            userName: object.userName,
            groups: object.groups,
            safeRoles: object.safeRoles,
            safeRights: object.safeRights
        }
        this.identity = this.attributes.id?.toString() as string
        this.uuid = this.attributes.userName as string
        this.disabled = object.active ? false : true
    }
}