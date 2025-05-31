#include <iostream>
using namespace std;

int sumOfEven(int arr[], int n){
    int ans = 0;
    for(int i = 0; i < n; i++){
        if(arr[i] % 2 == 0)
            ans += arr[i];
    }
    return ans;
}

int main() {
    int n;
    int arr[1000];
    cin >> n;
    for(int i = 0; i < n; i++)
        cin >> arr[i];
    cout << sumOfEven(arr,n);
    return 0;
}
