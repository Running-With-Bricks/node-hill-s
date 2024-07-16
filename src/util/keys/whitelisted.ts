/**
 * An enum that contains a list of all the keys allowed in player.keypress.
 * 
 * This is meant to verify packets to ensure that only valid key types are being sent.
 */
export enum KeyTypes {
    alphabetical = "a-z",
    numerical = "0-9",
    shift = "shift",
    lshift = "lshift",
    rshift = "rshift",
    control = "control",
    lcontrol = "lcontrol",
    rcontrol = "rcontrol",
    alt = "alt",
    ralt = "ralt",
    lalt = "lalt",
    tab = "tab",
    space = "space",
    return = "return",
    enter = "enter",
    backspace = "backspace",
    mouse1 = "mouse1",
    mouse2 = "mouse2",
    mouse3 = "mouse3",
    up = "up",
    down = "down",
    left = "left",
    right = "right",
}

const keys = "abcdefghijklmnopqrstuvwxyz0123456789".split("")

keys.push("shift","lshift","rshift",
    "control","lcontrol","rcontrol",
    "alt","ralt","lalt",
    "tab","space", "return","enter","backspace",
    "mouse1","mouse2","mouse3",
    "up","down","left","right"
)

export default keys