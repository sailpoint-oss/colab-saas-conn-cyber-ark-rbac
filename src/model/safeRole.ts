import { Attributes } from "@sailpoint/connector-sdk";
import { Permission } from "@sailpoint/connector-sdk";

export class SafeRole {
    identity: string
    uuid: string
    type: string = 'safeRole'
    attributes: Attributes
    permissions: Permission[]

    constructor(object: any) {
        this.attributes = {
            id: object.id?.toString(),
            displayName: object.displayName,
            description: object.description
        }
        this.identity = this.attributes.id as string
        this.uuid = this.attributes.displayName as string
        this.permissions = object.permissions
    }
}