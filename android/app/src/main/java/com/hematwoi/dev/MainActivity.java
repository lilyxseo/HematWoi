package com.hematwoi.dev;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.hematwoi.dev.widget.WidgetBridge;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(WidgetBridge.class);
    }
}
