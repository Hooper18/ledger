package com.tuchenguang.schedule;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册自定义 Capacitor 插件。Capacitor 6 自动发现 node_modules
        // 里的插件，但本地源码插件需要在这里显式 register。
        registerPlugin(WidgetSyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
