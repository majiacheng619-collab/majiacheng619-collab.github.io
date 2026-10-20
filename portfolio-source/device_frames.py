"""Decorative device surrounds for real screen captures."""


def device_frame(content, kind='mac'):
    if kind not in ('mac', 'tablet'):
        raise ValueError('Unknown device surround')
    if kind == 'mac':
        return (
            '<span class="device-frame device-frame--mac" data-device-frame="mac">'
            '<span class="mac-lid" aria-hidden="true"><svg class="mac-lid__mark" viewBox="0 0 24 28" fill="currentColor">'
            '<path d="M16.5 4.5C18 2.8 17.8.8 17.8.2c-1.6.1-3.6 1.1-4.6 2.3-1 1.1-1.8 2.8-1.6 4.3 1.8.1 3.6-.9 4.9-2.3ZM20 14.8c0-3.2 2.6-4.7 2.7-4.8-1.5-2.2-3.8-2.5-4.6-2.5-2-.2-3.9 1.2-4.9 1.2-1 0-2.6-1.2-4.3-1.1-2.2 0-4.3 1.3-5.4 3.2-2.3 4-.6 10 1.6 13.2 1.1 1.6 2.3 3.3 4 3.2 1.6-.1 2.3-1 4.3-1s2.6 1 4.3 1c1.8 0 2.9-1.6 3.9-3.2 1.3-1.8 1.8-3.6 1.8-3.7-.1 0-3.4-1.3-3.4-5.5Z"/>'
            '</svg></span>'
            '<span class="mac-front"><span class="device-frame__body">'
            '<span class="device-frame__camera" aria-hidden="true"></span>'
            '<span class="device-frame__screen">' + content + '</span></span>'
            '<span class="mac-deck" aria-hidden="true"><span class="mac-keyboard"></span><span class="mac-trackpad"></span></span>'
            '<span class="device-frame__base" aria-hidden="true"></span></span></span>'
        )
    return (
        f'<span class="device-frame device-frame--{kind}" data-device-frame="{kind}">'
        '<span class="device-frame__body">'
        '<span class="device-frame__camera" aria-hidden="true"></span>'
        '<span class="device-frame__screen">' + content + '</span></span>'
        + '</span>'
    )
