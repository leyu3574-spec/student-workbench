package com.student.workbench;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkbenchSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
