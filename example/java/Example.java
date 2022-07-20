
public class Example {

  public static Integer add(int a, Integer b) {
    if (b == null) {
      return null;
    }
    return a + b;
  }

  public static void main(String[] args) {
    System.out.println("add(1, 2): " + add(1, 2));
  }
}
